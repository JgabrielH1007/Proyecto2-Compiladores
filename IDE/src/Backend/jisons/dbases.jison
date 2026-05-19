/* Analizador lexico y sintactico para el lenguaje de DATABASE */
%{
    
%}

/* Analizador lexico */
%lex
%options case-sensitive

%%

\s+                         /* ignorar espacios */
"/*"[\s\S]*?"*/"            /* ignorar comentarios multilínea */

/* Palabras Reservadas */
"TABLE"                     return 'TABLE';
"COLUMNS"                   return 'COLUMNS';
"IN"                        return 'IN';
"DELETE"                    return 'DELETE';

/* Tipos de datos (Heredados del lenguaje principal) */
"int"                       return 'TYPE_INT';
"string"                    return 'TYPE_STRING';
"boolean"                   return 'TYPE_BOOLEAN';
"float"                     return 'TYPE_FLOAT';
"char"                      return 'TYPE_CHAR'; /* CORRECCIÓN: Se cambió number por char */

/* Valores constantes */
"true"                      return 'TRUE';
"false"                     return 'FALSE';

/* Símbolos Simples */
";"                         return ';';
","                         return ',';
"."                         return '.';
"="                         return '=';
"["                         return '[';
"]"                         return ']';
"("                         return '(';
")"                         return ')';
"{"                         return '{';
"}"                         return '}';
"+"                         return '+';
"-"                         return '-';
"*"                         return '*';
"/"                         return '/';
"%"                         return '%';
"!"                         return '!';

/* Símbolos Lógicos y Relacionales */
"=="                        return '==';
"!="                        return '!=';
"<="                        return '<=';
">="                        return '>=';
"<"                         return '<';
">"                         return '>';
"&&"                        return '&&';
"||"                        return '||';

/* Cadenas de texto, números e Identificadores */
\"([^\"\\]|\\.)*\"          return 'CADENA';
[0-9]+("."[0-9]+)?\b        return 'NUMERO';
[a-zA-Z_][a-zA-Z0-9_]* return 'IDENTIFICADOR';

<<EOF>>                     return 'EOF';
.                           { console.error('Error léxico en DB en línea ' + yylloc.first_line + ': ' + yytext); }

/lex

%left '||'
%left '&&'
%left '==' '!=' '<' '<=' '>' '>='
%left '+' '-'
%left '*' '/' '%'
%right '!'
%right UMINUS

%start inicio

%%

inicio
    : lista_consultas EOF { return $1; }
    ;

lista_consultas
    : lista_consultas consulta { $1.push($2); $$ = $1; }
    | consulta                 { $$ = [$1]; }
    ;

consulta
    : instruccion ';' { $$ = $1; }
    | instruccion     { $$ = $1; }
    ;

instruccion
    : crear_tabla
    | seleccionar_columna
    | insertar_o_actualizar_registro
    | eliminar_registro
    ;

crear_tabla
    : TABLE IDENTIFICADOR COLUMNS lista_definicion_columnas
        { $$ = {tipo: 'CREATE', tabla: $2, cols: $4}; }
    ;

lista_definicion_columnas
    : lista_definicion_columnas ',' definicion_columna { $1.push($3); $$ = $1; }
    | definicion_columna                               { $$ = [$1]; }
    ;

definicion_columna
    : IDENTIFICADOR '=' tipos_permitidos { $$ = {id: $1, tipo: $3}; }
    ;

tipos_permitidos
    : TYPE_INT | TYPE_STRING | TYPE_CHAR | TYPE_BOOLEAN | TYPE_FLOAT
    ;

seleccionar_columna
    : IDENTIFICADOR '.' IDENTIFICADOR { $$ = {tipo: 'SELECT_COL', tabla: $1, col: $3}; }
    ;

insertar_o_actualizar_registro
    : IDENTIFICADOR '[' lista_asignaciones ']'          
        { $$ = {tipo: 'INSERT', tabla: $1, data: $3}; }
    | IDENTIFICADOR '[' lista_asignaciones ']' IN NUMERO 
        { $$ = {tipo: 'UPDATE', tabla: $1, data: $3, id: $6}; }
    ;

lista_asignaciones
    : lista_asignaciones ',' asignacion { $1.push($3); $$ = $1; }
    | asignacion                        { $$ = [$1]; }
    ;

asignacion
    : IDENTIFICADOR '=' expresion { $$ = {col: $1, val: $3}; }
    ;

eliminar_registro
    : IDENTIFICADOR DELETE NUMERO { $$ = {tipo: 'DELETE', tabla: $1, id: $3}; }
    ;

expresion
    : expresion '+' expresion { $$ = {op: '+', izq: $1, der: $3}; }
    | expresion '-' expresion { $$ = {op: '-', izq: $1, der: $3}; }
    | expresion '*' expresion { $$ = {op: '*', izq: $1, der: $3}; }
    | expresion '/' expresion { $$ = {op: '/', izq: $1, der: $3}; }
    | expresion '%' expresion { $$ = {op: '%', izq: $1, der: $3}; }
    | '(' expresion ')'       { $$ = $2; }
    | '-' expresion %prec UMINUS { $$ = {op: '-', der: $2}; }
    | CADENA
    | NUMERO
    | TRUE
    | FALSE
    ;