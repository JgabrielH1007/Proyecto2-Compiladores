/* Analizador de estilos completo */

%{
    parser.erroresRecuperados = [];

    var _parsOriginal = parser.parse;
    parser.parse = function(input) {
        this._lineasFuente = input.split('\n');
        return _parsOriginal.call(this, input);
    };

    parser.parseError = function(str, hash) {
        if (hash.token === 'INVALID') {
            var lineaReal = (hash.line !== undefined) ? hash.line + 1 : (hash.loc ? hash.loc.first_line : 0);
            var columnaReal = 0;
            if (this._lineasFuente && hash.line !== undefined && hash.text) {
                var contenidoLinea = this._lineasFuente[hash.line] || '';
                var idx = contenidoLinea.indexOf(hash.text);
                if (idx >= 0) columnaReal = idx;
            }
            hash.loc = { first_line: lineaReal, first_column: columnaReal, last_line: lineaReal, last_column: columnaReal + 1 };
        }
        if (this.erroresRecuperados) {
            this.erroresRecuperados.push({ hash: hash });
        }
        if (!hash.recoverable) {
            var error = new Error(str);
            error.hash = hash;
            throw error;
        }
    };
%}

%lex
%options case-sensitive

%%

\s+                                                     /* ignorar espacios */
\/\*[\s\S]*?\*\/                                        /* comentarios multilínea */

"@for"                                                  return 'FOR';
"$"[a-zA-Z0-9_]+                                        return 'VARIABLE_FOR';

"background color"          return 'BACKGROUND_COLOR';
"border bottom style"       return 'BORDER_BOTTOM_STYLE';
"border bottom width"       return 'BORDER_BOTTOM_WIDTH';
"border bottom color"       return 'BORDER_BOTTOM_COLOR';
"border right style"        return 'BORDER_RIGHT_STYLE';
"border right width"        return 'BORDER_RIGHT_WIDTH';
"border right color"        return 'BORDER_RIGHT_COLOR';
"border left style"         return 'BORDER_LEFT_STYLE';
"border left width"         return 'BORDER_LEFT_WIDTH';
"border left color"         return 'BORDER_LEFT_COLOR';
"border top style"          return 'BORDER_TOP_STYLE';
"border top width"          return 'BORDER_TOP_WIDTH';
"border top color"          return 'BORDER_TOP_COLOR';
"padding bottom"            return 'PADDING_BOTTOM';
"margin bottom"             return 'MARGIN_BOTTOM';
"border radius"             return 'BORDER_RADIUS';
"border bottom"             return 'BORDER_BOTTOM';
"border right"              return 'BORDER_RIGHT';
"padding right"             return 'PADDING_RIGHT';
"margin right"              return 'MARGIN_RIGHT';
"padding left"              return 'PADDING_LEFT';
"margin left"               return 'MARGIN_LEFT';
"border style"              return 'BORDER_STYLE';
"border width"              return 'BORDER_WIDTH';
"border color"              return 'BORDER_COLOR';
"padding top"               return 'PADDING_TOP';
"margin top"                return 'MARGIN_TOP';
"border left"               return 'BORDER_LEFT';
"border top"                return 'BORDER_TOP';
"text align"                return 'TEXT_ALIGN';
"text font"                 return 'TEXT_FONT';
"text size"                 return 'TEXT_SIZE';
"min-height"                return 'MIN_HEIGHT';
"max-height"                return 'MAX_HEIGHT';
"min-width"                 return 'MIN_WIDTH';
"max-width"                 return 'MAX_WIDTH';
"SANS SERIF"                return 'FONT_FAMILY';


[a-zA-Z][a-zA-Z0-9-]* {
    var keywords = {

        'from'      : 'FROM',
        'through'   : 'THROUGH',
        'to'        : 'TO',
        'extends'   : 'EXTENDS',

        'padding'   : 'PADDING',
        'margin'    : 'MARGIN',
        'border'    : 'BORDER',
        'height'    : 'HEIGHT',
        'width'     : 'WIDTH',
        'color'     : 'COLOR',

        'CENTER'    : 'DIRECCION',
        'RIGHT'     : 'DIRECCION',
        'LEFT'      : 'DIRECCION',

        'HELVETICA' : 'FONT_FAMILY',
        'SANS'      : 'FONT_FAMILY',
        'MONO'      : 'FONT_FAMILY',
        'CURSIVE'   : 'FONT_FAMILY',

        'DOTTED'    : 'BORDER_KIND',
        'LINE'      : 'BORDER_KIND',
        'DOUBLE'    : 'BORDER_KIND',
        'SOLID'     : 'BORDER_KIND',
        'solid'     : 'BORDER_KIND',

        'blue'      : 'COLOR_NAME',
        'white'     : 'COLOR_NAME',
        'red'       : 'COLOR_NAME',
        'green'     : 'COLOR_NAME',
        'violet'    : 'COLOR_NAME',
        'gray'      : 'COLOR_NAME',
        'black'     : 'COLOR_NAME',
        'lightgray' : 'COLOR_NAME',

        'rgb'       : 'RGB_FUNC'
    };
    return keywords[yytext] || 'IDENTIFICADOR';
}


"#"[a-fA-F0-9]{6}   return 'HEX_COLOR';
"#"[a-fA-F0-9]{3}   return 'HEX_COLOR';


[0-9]+"."[0-9]+"%"  return 'PORCENTAJE';
[0-9]+"%"           return 'PORCENTAJE';
[0-9]+"."[0-9]+     return 'NUMERO';
[0-9]+              return 'NUMERO';


"{"                 return '{';
"}"                 return '}';
";"                 return ';';
"="                 return '=';
","                 return ',';
"("                 return '(';
")"                 return ')';
"*"                 return '*';
"/"                 return '/';
"+"                 return '+';
"-"                 return '-';
"%"                 return '%';

<<EOF>>             return 'EOF';
.                   { return 'INVALID'; }

/lex

%left '+' '-'
%left '*' '/' '%'
%right UMINUS

%start hoja_estilos

%%

hoja_estilos
    : elementos EOF { return $1; }
    ;

elementos
    : elementos elemento { $1.push($2); $$ = $1; }
    | elemento           { $$ = [$1]; }
    ;

elemento
    : definicion_estilo { $$ = $1; }
    | ciclo_for         { $$ = $1; }
    ;

definicion_estilo
    : selector_clase '{' declaraciones '}'
        { $$ = { tipo: 'ESTILO', selector: $1, extends: null, declaraciones: $3 }; }
    | selector_clase EXTENDS IDENTIFICADOR '{' declaraciones '}'
        { $$ = { tipo: 'ESTILO', selector: $1, extends: $3, declaraciones: $5 }; }
    ;

selector_clase
    : IDENTIFICADOR
        { $$ = { id: $1, variable: null }; }
    | IDENTIFICADOR VARIABLE_FOR
        { $$ = { id: $1, variable: $2 }; }
    ;

declaraciones
    : declaraciones declaracion { $1.push($2); $$ = $1; }
    | declaraciones error ';'   { $$ = $1; }
    | /* vacío */               { $$ = []; }
    ;

propiedad_medida
    : HEIGHT              { $$ = $1; }
    | WIDTH               { $$ = $1; }
    | MIN_WIDTH           { $$ = $1; }
    | MAX_WIDTH           { $$ = $1; }
    | MIN_HEIGHT          { $$ = $1; }
    | MAX_HEIGHT          { $$ = $1; }
    | TEXT_SIZE           { $$ = $1; }
    | BORDER_RADIUS       { $$ = $1; }
    | BORDER_WIDTH        { $$ = $1; }
    | PADDING             { $$ = $1; }
    | PADDING_LEFT        { $$ = $1; }
    | PADDING_RIGHT       { $$ = $1; }
    | PADDING_TOP         { $$ = $1; }
    | PADDING_BOTTOM      { $$ = $1; }
    | MARGIN              { $$ = $1; }
    | MARGIN_LEFT         { $$ = $1; }
    | MARGIN_RIGHT        { $$ = $1; }
    | MARGIN_TOP          { $$ = $1; }
    | MARGIN_BOTTOM       { $$ = $1; }
    | BORDER_TOP_WIDTH    { $$ = $1; }
    | BORDER_RIGHT_WIDTH  { $$ = $1; }
    | BORDER_BOTTOM_WIDTH { $$ = $1; }
    | BORDER_LEFT_WIDTH   { $$ = $1; }
    ;

propiedad_estilo_borde
    : BORDER_STYLE        { $$ = $1; }
    | BORDER_TOP_STYLE    { $$ = $1; }
    | BORDER_RIGHT_STYLE  { $$ = $1; }
    | BORDER_BOTTOM_STYLE { $$ = $1; }
    | BORDER_LEFT_STYLE   { $$ = $1; }
    ;

propiedad_color_borde
    : BORDER_COLOR        { $$ = $1; }
    | BORDER_TOP_COLOR    { $$ = $1; }
    | BORDER_RIGHT_COLOR  { $$ = $1; }
    | BORDER_BOTTOM_COLOR { $$ = $1; }
    | BORDER_LEFT_COLOR   { $$ = $1; }
    ;

propiedad_borde_abreviado
    : BORDER        { $$ = $1; }
    | BORDER_TOP    { $$ = $1; }
    | BORDER_RIGHT  { $$ = $1; }
    | BORDER_BOTTOM { $$ = $1; }
    | BORDER_LEFT   { $$ = $1; }
    ;

declaracion
    : propiedad_medida '=' valor_medida ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | propiedad_estilo_borde '=' BORDER_KIND ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | propiedad_color_borde '=' valor_color ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | propiedad_borde_abreviado '=' valor_medida BORDER_KIND valor_color ';'
        { $$ = { propiedad: $1, valor: $3, isShorthand: true, estilo: $4, color: $5 }; }
    | BACKGROUND_COLOR '=' valor_color ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | COLOR '=' valor_color ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | TEXT_ALIGN '=' DIRECCION ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    | TEXT_FONT '=' FONT_FAMILY ';'
        { $$ = { propiedad: $1, valor: $3 }; }
    ;

valor_medida
    : expresion_numerica { $$ = $1; }
    | PORCENTAJE         { $$ = $1; }
    ;

valor_color
    : COLOR_NAME { $$ = $1; }
    | HEX_COLOR  { $$ = $1; }
    | RGB_FUNC '(' NUMERO ',' NUMERO ',' NUMERO ')' { $$ = 'rgb(' + $3 + ',' + $5 + ',' + $7 + ')'; }
    ;

expresion_numerica
    : NUMERO                                    { $$ = Number($1); }
    | VARIABLE_FOR                              { $$ = $1; }
    | expresion_numerica '+' expresion_numerica { $$ = { op: '+', izq: $1, der: $3 }; }
    | expresion_numerica '-' expresion_numerica { $$ = { op: '-', izq: $1, der: $3 }; }
    | expresion_numerica '*' expresion_numerica { $$ = { op: '*', izq: $1, der: $3 }; }
    | expresion_numerica '/' expresion_numerica { $$ = { op: '/', izq: $1, der: $3 }; }
    | expresion_numerica '%' expresion_numerica { $$ = { op: '%', izq: $1, der: $3 }; }
    | '(' expresion_numerica ')'                { $$ = $2; }
    | '-' expresion_numerica %prec UMINUS       { $$ = { op: 'UMINUS', der: $2 }; }
    ;

ciclo_for
    : FOR VARIABLE_FOR FROM expresion_numerica tipo_rango expresion_numerica '{' cuerpo_for '}'
        { $$ = { tipo: 'FOR', variable: $2, inicio: $4, rango: $5, fin: $6, cuerpo: $8 }; }
    ;

tipo_rango
    : THROUGH { $$ = $1; }
    | TO      { $$ = $1; }
    ;

cuerpo_for
    : cuerpo_for definicion_estilo { $1.push($2); $$ = $1; }
    | definicion_estilo            { $$ = [$1]; }
    ;