/* coloreador.jison - Lexer universal para el IDE YFERA */

%lex

%%

\s+                   return 'ESPACIO';

\/\*[\s\S]*?\*\/  return 'COMENTARIO';
"#".* return 'COMENTARIO';

/* Strings Literales (Naranja) */
"\""[^"]*"\""         return 'STRING';
\'[^\']*\'          return 'STRING';
"`"[^`]*"`"           return 'STRING';

/* Variables (Blanco) */
"$"[a-zA-Z_][a-zA-Z0-9_]* return 'VARIABLE';
"@"[a-zA-Z_][a-zA-Z0-9_]* return 'VARIABLE';

/* Palabras Reservadas (Morado) */
(import|execute|load|function|main|int|float|string|boolean|char|if|else|Switch|switch|empty|case|default|while|do|for|break|continue|TABLE|COLUMNS|IN|DELETE|T|IMG|FORM|SUBMIT|INPUT_TEXT|INPUT_NUMBER|INPUT_BOOL|each|track|empty|extends|from|through|to|base|background|color|border|bottom|top|right|left|padding|margin|radius|width|height|style|text|align|font|size)\b return 'PALABRA_RESERVADA';

/* Otros Literales numéricos y booleanos (Celeste) */
[0-9]+("."[0-9]+)?  return 'LITERAL';
"true"|"false"     return 'LITERAL';

/* Llaves, corchetes, paréntesis (Azul) */
[\{\}\[\]\(\)]        return 'BRACKET';

/* Operadores (Verde) */
"<="|">="|"<"|">"|"&&"|"||"|"=="|"!="|"++"|"+"|"-"|"*"|"/"|"%"|"!"|"=" return 'OPERADOR';

/* Cualquier otro caracter (Blanco/Default) */
.                     return 'OTRO';
<<EOF>>               return 'EOF';

/lex

/* Definición de la sintaxis */
%start inicio

%%

inicio
    : elementos EOF { return $1; }
    | EOF { return ""; }
    ;

elementos
    : elementos elemento { $$ = $1 + $2; }
    | elemento { $$ = $1; }
    ;

elemento
    : COMENTARIO  { $$ = '<span style="color: #9E9E9E; font-style: italic;">' + yytext.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</span>'; }
    | STRING   { $$ = '<span style="color: #FFA500;">' + yytext.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</span>'; }
    | PALABRA_RESERVADA  { $$ = '<span style="color: #BA68C8;">' + yytext + '</span>'; }
    | VARIABLE { $$ = '<span style="color: #FFFFFF;">' + yytext + '</span>'; }
    | LITERAL  { $$ = '<span style="color: #4DD0E1;">' + yytext + '</span>'; }
    | BRACKET  { $$ = '<span style="color:rgb(2, 19, 247);">' + yytext + '</span>'; }
    | OPERADOR { $$ = '<span style="color: #4CAF50;">' + yytext.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</span>'; }
    | ESPACIO    { $$ = yytext; }
    | OTRO      { $$ = '<span style="color: #FFFFFF;">' + yytext.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;") + '</span>'; }
    ;