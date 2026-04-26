%{
    /*Analizador de estilos completo*/
%}

%lex
%options case-sensitive

%%

\s+                                                                     /* ignorar espacios */
\/\*[\s\S]*?\*\/                                                        /* comentarios multilínea */

"@for"                                                                  return 'FOR';
"from"                                                                  return 'FROM';
"through"                                                               return 'THROUGH';
"to"                                                                    return 'TO';
"extends"                                                               return 'EXTENDS';


"background color"                                                      return 'BACKGROUND_COLOR'; 
"border bottom style"                                                   return 'BORDER_BOTTOM_STYLE';
"border bottom width"                                                   return 'BORDER_BOTTOM_WIDTH';
"border bottom color"                                                   return 'BORDER_BOTTOM_COLOR';
"border right style"                                                    return 'BORDER_RIGHT_STYLE';
"border right width"                                                    return 'BORDER_RIGHT_WIDTH';
"border right color"                                                    return 'BORDER_RIGHT_COLOR';
"border left style"                                                     return 'BORDER_LEFT_STYLE';
"border left width"                                                     return 'BORDER_LEFT_WIDTH';
"border left color"                                                     return 'BORDER_LEFT_COLOR';
"border top style"                                                      return 'BORDER_TOP_STYLE';
"border top width"                                                      return 'BORDER_TOP_WIDTH';
"border top color"                                                      return 'BORDER_TOP_COLOR';
"padding bottom"                                                        return 'PADDING_BOTTOM';
"margin bottom"                                                         return 'MARGIN_BOTTOM';
"border radius"                                                         return 'BORDER_RADIUS';
"border bottom"                                                         return 'BORDER_BOTTOM';
"border right"                                                          return 'BORDER_RIGHT';
"padding right"                                                         return 'PADDING_RIGHT';
"margin right"                                                          return 'MARGIN_RIGHT';
"padding left"                                                          return 'PADDING_LEFT';
"margin left"                                                           return 'MARGIN_LEFT';
"border style"                                                          return 'BORDER_STYLE';
"border width"                                                          return 'BORDER_WIDTH';
"border color"                                                          return 'BORDER_COLOR';
"padding top"                                                           return 'PADDING_TOP';
"margin top"                                                            return 'MARGIN_TOP';
"border left"                                                           return 'BORDER_LEFT';
"border top"                                                            return 'BORDER_TOP';
"text align"                                                            return 'TEXT_ALIGN';
"text font"                                                             return 'TEXT_FONT';
"text size"                                                             return 'TEXT_SIZE';
"min-height"                                                            return 'MIN_HEIGHT';
"max-height"                                                            return 'MAX_HEIGHT';
"min-width"                                                             return 'MIN_WIDTH';
"max-width"                                                             return 'MAX_WIDTH';
"padding"                                                               return 'PADDING';
"margin"                                                                return 'MARGIN';
"border"                                                                return 'BORDER';
"height"                                                                return 'HEIGHT';
"width"                                                                 return 'WIDTH';
"color"                                                                 return 'COLOR';

CENTER|RIGHT|LEFT                                                       return 'DIRECCION';
HELVETICA|SANS\s+SERIF|SANS|MONO|CURSIVE                                return 'FONT_FAMILY'; 
DOTTED|LINE|DOUBLE|solid                                                return 'BORDER_KIND';
blue|white|red|green|violet|gray|black|lightgray                        return 'COLOR_NAME';
"rgb"                                                                   return 'RGB_FUNC';
"#"([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\b                                    return 'HEX_COLOR';

"{"                                                                     return '{';
"}"                                                                     return '}';
";"                                                                     return ';';
"="                                                                     return '=';
","                                                                     return ',';
"("                                                                     return '(';
")"                                                                     return ')';
"*"                                                                     return '*';
"/"                                                                     return '/';
"+"                                                                     return '+';
"-"                                                                     return '-';

[0-9]+"."[0-9]+"%"                                                      return 'PORCENTAJE';
[0-9]+"%"                                                               return 'PORCENTAJE';
[0-9]+"."[0-9]+\b                                                       return 'NUMERO';
[0-9]+\b                                                                return 'NUMERO';
[a-zA-Z][a-zA-Z0-9-]* return 'IDENTIFICADOR';
\$[a-zA-Z0-9_]+                                                         return 'VARIABLE_FOR';
"$"                                                                     return '$';
"%"                                                                     return '%';
<<EOF>>                                                                 return 'EOF';
.                                                                       { console.error('Error léxico en línea ' + yylloc.first_line + ': ' + yytext); }

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
    | elemento          { $$ = [$1]; }
    ;

elemento
    : definicion_estilo
    | ciclo_for
    ;

definicion_estilo
    : selector_clase '{' declaraciones '}' 
    | selector_clase EXTENDS IDENTIFICADOR '{' declaraciones '}'
    ;

selector_clase
    : IDENTIFICADOR
    | IDENTIFICADOR VARIABLE_FOR 
    ;

declaraciones
    : declaraciones declaracion
    | /* vacío */
    ;

propiedad_medida
    : HEIGHT | WIDTH | MIN_WIDTH | MAX_WIDTH | MIN_HEIGHT | MAX_HEIGHT 
    | TEXT_SIZE | BORDER_RADIUS | BORDER_WIDTH
    | PADDING | PADDING_LEFT | PADDING_RIGHT | PADDING_TOP | PADDING_BOTTOM
    | MARGIN | MARGIN_LEFT | MARGIN_RIGHT | MARGIN_TOP | MARGIN_BOTTOM
    | BORDER_TOP_WIDTH | BORDER_RIGHT_WIDTH | BORDER_BOTTOM_WIDTH | BORDER_LEFT_WIDTH
    ;

propiedad_estilo_borde
    : BORDER_STYLE | BORDER_TOP_STYLE | BORDER_RIGHT_STYLE | BORDER_BOTTOM_STYLE | BORDER_LEFT_STYLE
    ;

propiedad_color_borde
    : BORDER_COLOR | BORDER_TOP_COLOR | BORDER_RIGHT_COLOR | BORDER_BOTTOM_COLOR | BORDER_LEFT_COLOR
    ;

propiedad_borde_abreviado
    : BORDER | BORDER_TOP | BORDER_RIGHT | BORDER_BOTTOM | BORDER_LEFT
    ;

declaracion
    : propiedad_medida '=' valor_medida ';'
    | propiedad_estilo_borde '=' BORDER_KIND ';'
    | propiedad_color_borde '=' valor_color ';'
    | propiedad_borde_abreviado '=' valor_medida BORDER_KIND valor_color ';'
    | BACKGROUND_COLOR '=' valor_color ';'
    | COLOR '=' valor_color ';'
    | TEXT_ALIGN '=' DIRECCION ';'
    | TEXT_FONT '=' FONT_FAMILY ';'
    ;

valor_medida
    : expresion_numerica
    | PORCENTAJE
    ;

valor_color
    : COLOR_NAME
    | HEX_COLOR
    | RGB_FUNC '(' NUMERO ',' NUMERO ',' NUMERO ')'
    ;

expresion_numerica
    : NUMERO
    | VARIABLE_FOR
    | expresion_numerica '+' expresion_numerica
    | expresion_numerica '-' expresion_numerica
    | expresion_numerica '*' expresion_numerica
    | expresion_numerica '/' expresion_numerica
    | expresion_numerica '%' expresion_numerica
    | '(' expresion_numerica ')'
    | '-' expresion_numerica %prec UMINUS
    ;

ciclo_for
    : FOR VARIABLE_FOR FROM expresion_numerica tipo_rango expresion_numerica '{' cuerpo_for '}'
    ;

tipo_rango
    : THROUGH
    | TO
    ;

cuerpo_for
    : cuerpo_for definicion_estilo
    | /* vacío */
    ;