/* Analizador de estilos completo */

%{
    // Lógica adicional si se requiere
%}

%lex
%options case-sensitive

%%

\s+                                                     /* ignorar espacios */
\/\*[\s\S]*?\*\/                                        /* comentarios multilínea */

"@for"                                                  return 'FOR';
"from"                                                  return 'FROM';
"through"                                               return 'THROUGH';
"to"                                                    return 'TO';
"extends"                                               return 'EXTENDS';

"background color"                                      return 'BACKGROUND_COLOR'; 
"border bottom style"                                   return 'BORDER_BOTTOM_STYLE';
"border bottom width"                                   return 'BORDER_BOTTOM_WIDTH';
"border bottom color"                                   return 'BORDER_BOTTOM_COLOR';
"border right style"                                    return 'BORDER_RIGHT_STYLE';
"border right width"                                    return 'BORDER_RIGHT_WIDTH';
"border right color"                                    return 'BORDER_RIGHT_COLOR';
"border left style"                                     return 'BORDER_LEFT_STYLE';
"border left width"                                     return 'BORDER_LEFT_WIDTH';
"border left color"                                     return 'BORDER_LEFT_COLOR';
"border top style"                                      return 'BORDER_TOP_STYLE';
"border top width"                                      return 'BORDER_TOP_WIDTH';
"border top color"                                      return 'BORDER_TOP_COLOR';
"padding bottom"                                        return 'PADDING_BOTTOM';
"margin bottom"                                         return 'MARGIN_BOTTOM';
"border radius"                                         return 'BORDER_RADIUS';
"border bottom"                                         return 'BORDER_BOTTOM';
"border right"                                          return 'BORDER_RIGHT';
"padding right"                                         return 'PADDING_RIGHT';
"margin right"                                          return 'MARGIN_RIGHT';
"padding left"                                          return 'PADDING_LEFT';
"margin left"                                           return 'MARGIN_LEFT';
"border style"                                          return 'BORDER_STYLE';
"border width"                                          return 'BORDER_WIDTH';
"border color"                                          return 'BORDER_COLOR';
"padding top"                                           return 'PADDING_TOP';
"margin top"                                            return 'MARGIN_TOP';
"border left"                                           return 'BORDER_LEFT';
"border top"                                            return 'BORDER_TOP';
"text align"                                            return 'TEXT_ALIGN';
"text font"                                             return 'TEXT_FONT';
"text size"                                             return 'TEXT_SIZE';
"min-height"                                            return 'MIN_HEIGHT';
"max-height"                                            return 'MAX_HEIGHT';
"min-width"                                             return 'MIN_WIDTH';
"max-width"                                             return 'MAX_WIDTH';
"padding"                                               return 'PADDING';
"margin"                                                return 'MARGIN';
"border"                                                return 'BORDER';
"height"                                                return 'HEIGHT';
"width"                                                 return 'WIDTH';
"color"                                                 return 'COLOR';

CENTER|RIGHT|LEFT                                       return 'DIRECCION';
HELVETICA|SANS\s+SERIF|SANS|MONO|CURSIVE                return 'FONT_FAMILY'; 
DOTTED|LINE|DOUBLE|solid                                return 'BORDER_KIND';
blue|white|red|green|violet|gray|black|lightgray        return 'COLOR_NAME';
"rgb"                                                   return 'RGB_FUNC';
"#"([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b                    return 'HEX_COLOR';

"{"                                                     return '{';
"}"                                                     return '}';
";"                                                     return ';';
"="                                                     return '=';
","                                                     return ',';
"("                                                     return '(';
")"                                                     return ')';
"*"                                                     return '*';
"/"                                                     return '/';
"+"                                                     return '+';
"-"                                                     return '-';

[0-9]+"."[0-9]+"%"                                      return 'PORCENTAJE';
[0-9]+"%"                                               return 'PORCENTAJE';
[0-9]+"."[0-9]+\b                                       return 'NUMERO';
[0-9]+\b                                                return 'NUMERO';
[a-zA-Z][a-zA-Z0-9-]*                                   return 'IDENTIFICADOR';
\$[a-zA-Z0-9_]+                                         return 'VARIABLE_FOR';
"$"                                                     return '$';
"%"                                                     return '%';
<<EOF>>                                                 return 'EOF';
.                                                       { console.error('Error léxico en línea ' + yylloc.first_line + ': ' + yytext); }

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
    | /* vacío */               { $$ = []; }
    ;

propiedad_medida
    : HEIGHT | WIDTH | MIN_WIDTH | MAX_WIDTH | MIN_HEIGHT | MAX_HEIGHT 
    | TEXT_SIZE | BORDER_RADIUS | BORDER_WIDTH
    | PADDING | PADDING_LEFT | PADDING_RIGHT | PADDING_TOP | PADDING_BOTTOM
    | MARGIN | MARGIN_LEFT | MARGIN_RIGHT | MARGIN_TOP | MARGIN_BOTTOM
    | BORDER_TOP_WIDTH | BORDER_RIGHT_WIDTH | BORDER_BOTTOM_WIDTH | BORDER_LEFT_WIDTH
    { $$ = $1; }
    ;

propiedad_estilo_borde
    : BORDER_STYLE | BORDER_TOP_STYLE | BORDER_RIGHT_STYLE | BORDER_BOTTOM_STYLE | BORDER_LEFT_STYLE
    { $$ = $1; }
    ;

propiedad_color_borde
    : BORDER_COLOR | BORDER_TOP_COLOR | BORDER_RIGHT_COLOR | BORDER_BOTTOM_COLOR | BORDER_LEFT_COLOR
    { $$ = $1; }
    ;

propiedad_borde_abreviado
    : BORDER | BORDER_TOP | BORDER_RIGHT | BORDER_BOTTOM | BORDER_LEFT
    { $$ = $1; }
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
    : NUMERO                                     { $$ = Number($1); }
    | VARIABLE_FOR                               { $$ = $1; }
    | expresion_numerica '+' expresion_numerica  { $$ = {op: '+', izq: $1, der: $3}; }
    | expresion_numerica '-' expresion_numerica  { $$ = {op: '-', izq: $1, der: $3}; }
    | expresion_numerica '*' expresion_numerica  { $$ = {op: '*', izq: $1, der: $3}; }
    | expresion_numerica '/' expresion_numerica  { $$ = {op: '/', izq: $1, der: $3}; }
    | expresion_numerica '%' expresion_numerica  { $$ = {op: '%', izq: $1, der: $3}; }
    | '(' expresion_numerica ')'                 { $$ = $2; }
    | '-' expresion_numerica %prec UMINUS        { $$ = {op: 'UMINUS', der: $2}; }
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
    | /* vacío */                  { $$ = []; }
    ;