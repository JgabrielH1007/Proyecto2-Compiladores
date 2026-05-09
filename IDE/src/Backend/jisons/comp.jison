/* Analizador lexico y sintactico de lenguaje de componentes */

%{

%}


%lex
%options case-sensitive
%%

\s+                         /* ignorar espacios */
\/\*[\s\S]*?\*\/            /* ignorar comentarios multilínea */


"INPUT_TEXT"                return 'INPUT_TEXT';
"INPUT_NUMBER"              return 'INPUT_NUMBER';
"INPUT_BOOL"                return 'INPUT_BOOL';
"[["                        return '[[';
"]]"                        return ']]';
"=="                        return '==';
"!="                        return '!=';
"<="                        return '<=';
">="                        return '>=';
"&&"                        return '&&';
"||"                        return '||';


[a-zA-Z_][a-zA-Z0-9_-]* {
    var keywords = {
        /* Tipos */
        'int'       : 'INT',
        'string'    : 'STRING',
        'function'  : 'FUNCTION',
        'float'     : 'FLOAT',
        'boolean'   : 'BOOLEAN',
        'char'      : 'CHAR',
        /* Elementos visuales de una sola palabra */
        'T'         : 'T',
        'IMG'       : 'IMG',
        'FORM'      : 'FORM',
        'SUBMIT'    : 'SUBMIT',
        /* Propiedades de inputs */
        'id'        : 'PR_ID',
        'label'     : 'PR_LABEL',
        'value'     : 'PR_VALUE',
        'true'      : 'TRUE',
        'false'     : 'FALSE',
        /* Control de flujo */
        'for'       : 'FOR',
        'each'      : 'EACH',
        'track'     : 'TRACK',
        'empty'     : 'EMPTY',
        'if'        : 'IF',
        'else'      : 'ELSE',
        'Switch'    : 'SWITCH',
        'case'      : 'CASE',
        'default'   : 'DEFAULT',
    };
    return keywords[yytext] || 'IDENTIFICADOR';
}

/* Literales y símbolos */
\"([^\"\\]|\\.)*\"          return 'CADENA';
"$"[a-zA-Z0-9_]+            return 'VARIABLE';
"@"[a-zA-Z0-9_]+            return 'REF_ID';
[0-9]+(?:\.[0-9]+)?         return 'NUMERO';

"["                         return '[';
"]"                         return ']';
"<"                         return '<';
">"                         return '>';
"("                         return '(';
")"                         return ')';
"{"                         return '{';
"}"                         return '}';
","                         return ',';
":"                         return ':';
"+"                         return '+';
"-"                         return '-';
"*"                         return '*';
"/"                         return '/';
"%"                         return '%';
"!"                         return '!';

<<EOF>>                     return 'EOF';
.                           { console.error('Error léxico en línea ' + yylloc.first_line + ': ' + yytext); }

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
    : lista_componentes EOF { return $1; }
    ;

lista_componentes
    : lista_componentes componente { $1.push($2); $$ = $1; }
    | componente                   { $$ = [$1]; }
    ;

componente
    : IDENTIFICADOR '(' parametros_opt ')' '{' elementos '}'
        { $$ = {tipo: 'COMPONENTE_DEF', id: $1, params: $3, body: $6}; }
    ;

parametros_opt
    : lista_parametros { $$ = $1; }
    | /* vacío */      { $$ = []; }
    ;

lista_parametros
    : lista_parametros ',' parametro { $1.push($3); $$ = $1; }
    | parametro                      { $$ = [$1]; }
    ;

parametro
    : tipo IDENTIFICADOR { $$ = {tipo: $1, id: $2}; }
    | tipo VARIABLE      { $$ = {tipo: $1, id: $2}; }
    ;

tipo
    : tipo_base '[' ']' { $$ = { base: $1, isArray: true }; }
    | tipo_base         { $$ = { base: $1, isArray: false }; }
    ;

tipo_base
    : INT      { $$ = 'int'; }
    | FLOAT    { $$ = 'float'; }
    | STRING   { $$ = 'string'; }
    | BOOLEAN  { $$ = 'boolean'; }
    | CHAR     { $$ = 'char'; }
    | FUNCTION { $$ = 'function'; }
    ;

elementos
    : elementos_no_vacio { $$ = $1; }
    | /* vacío */        { $$ = []; }
    ;

elementos_no_vacio
    : elementos_no_vacio elemento { $1.push($2); $$ = $1; }
    | elemento                    { $$ = [$1]; }
    ;


elemento
    : seccion
    | tabla
    | texto
    | imagen
    | formulario
    | input_form
    | logica_for
    | logica_if
    | logica_switch
    | invocacion_componente
    ;

estilos_opt
    : '<' lista_ids '>' { $$ = $2; }
    ;

lista_ids
    : lista_ids ',' IDENTIFICADOR { $1.push($3); $$ = $1; }
    | IDENTIFICADOR               { $$ = [$1]; }
    ;



seccion
    : estilos_opt '[' elementos ']' { $$ = {tipo: 'SECTION', estilos: $1, contenido: $3}; }
    | '[' elementos ']'             { $$ = {tipo: 'SECTION', estilos: [], contenido: $2}; }
    ;

tabla
    : estilos_opt '[[' lista_filas ']]' { $$ = {tipo: 'TABLA', estilos: $1, filas: $3}; }
    | '[[' lista_filas ']]'             { $$ = {tipo: 'TABLA', estilos: [], filas: $2}; }
    ;

lista_filas
    : lista_filas item_fila { $1.push($2); $$ = $1; }
    | item_fila             { $$ = [$1]; }
    ;
item_fila
    : fila
    | logica_for_fila
    | logica_if_fila
    | logica_switch_fila
    ;

logica_for_fila
    : FOR EACH '(' VARIABLE ':' VARIABLE ')' '{' lista_filas '}'
        { $$ = {tipo: 'FOR_EACH', iterador: $4, coleccion: $6, body: $9}; }
    | FOR '(' lista_vars_for ')' TRACK VARIABLE '{' lista_filas '}' empty_opt_filas
        { $$ = {tipo: 'FOR_TRACK', vars: $3, track: $6, body: $8, empty: $10}; }
    ;

empty_opt_filas
    : EMPTY '{' lista_filas '}' { $$ = $3; }
    | /* vacío */               { $$ = null; }
    ;

logica_if_fila
    : IF '(' expresion ')' '{' lista_filas '}' lista_elseif_fila else_opt_filas
        { $$ = {tipo: 'IF', cond: $3, body: $6, elseifs: $7, sino: $8}; }
    ;

lista_elseif_fila
    : lista_elseif_fila ELSE IF '(' expresion ')' '{' lista_filas '}'
        { $1.push({cond: $5, body: $8}); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

else_opt_filas
    : ELSE '{' lista_filas '}' { $$ = $3; }
    | /* vacío */              { $$ = null; }
    ;

logica_switch_fila
    : SWITCH '(' expresion_switch ')' '{' lista_cases_fila default_opt_filas '}'
        { $$ = {tipo: 'SWITCH', expr: $3, cases: $6, def: $7}; }
    ;

lista_cases_fila
    : lista_cases_fila caso_fila { $1.push($2); $$ = $1; }
    | caso_fila                  { $$ = [$1]; }
    ;

caso_fila
    : CASE valor_case '{' lista_filas '}' ',' { $$ = {val: $2, body: $4}; }
    | CASE valor_case '{' lista_filas '}'     { $$ = {val: $2, body: $4}; }
    ;

default_opt_filas
    : DEFAULT '{' lista_filas '}' { $$ = $3; }
    | /* vacío */                 { $$ = null; }
    ;
    
fila
    : '[[' lista_columnas ']]' { $$ = $2; }
    ;

lista_columnas
    : lista_columnas columna { $1.push($2); $$ = $1; }
    | columna                { $$ = [$1]; }
    ;

columna
    : '[[' elementos ']]' { $$ = {tipo: 'CELDA', contenido: $2}; }
    ;

texto
    : T estilos_opt '(' CADENA ')' { $$ = {tipo: 'TEXTO', estilos: $2, val: $4}; }
    | T '(' CADENA ')'             { $$ = {tipo: 'TEXTO', estilos: [], val: $3}; }
    ;

imagen
    : IMG estilos_opt '(' lista_valores ')' { $$ = {tipo: 'IMG', estilos: $2, vals: $4}; }
    | IMG '(' lista_valores ')'             { $$ = {tipo: 'IMG', estilos: [], vals: $3}; }
    ;

lista_valores
    : lista_valores ',' valor { $1.push($3); $$ = $1; }
    | valor                   { $$ = [$1]; }
    ;

/* --- FORMULARIOS --- */

formulario
    : FORM estilos_opt '{' elementos '}' submit_opt
        { $$ = {tipo: 'FORM', estilos: $2, body: $4, submit: $6}; }
    | FORM '{' elementos '}' submit_opt
        { $$ = {tipo: 'FORM', estilos: [], body: $3, submit: $5}; }
    ;

submit_opt
    : SUBMIT estilos_opt '{' props_submit '}'
        { $$ = {tipo: 'SUBMIT', estilos: $2, props: $4}; }
    | SUBMIT '{' props_submit '}'
        { $$ = {tipo: 'SUBMIT', estilos: [], props: $3}; }
    | /* vacío */ { $$ = null; }
    ;

props_submit
    : props_submit prop_submit { $1.push($2); $$ = $1; }
    | prop_submit              { $$ = [$1]; }
    ;

prop_submit
    : PR_LABEL ':' CADENA
        { $$ = {tipo: 'LABEL', val: $3}; }
    | FUNCTION ':' VARIABLE '(' lista_ref_id_opt ')'
        { $$ = {tipo: 'FUNCTION', fn: $3, refs: $5}; }
    ;

lista_ref_id_opt
    : lista_ref_id { $$ = $1; }
    | /* vacío */  { $$ = []; }
    ;

lista_ref_id
    : lista_ref_id ',' REF_ID { $1.push($3); $$ = $1; }
    | REF_ID                  { $$ = [$1]; }
    ;

input_form
    : INPUT_TEXT estilos_opt '(' props_input ')'
        { $$ = {tipo: 'INPUT_TEXT', estilos: $2, props: $4}; }
    | INPUT_TEXT '(' props_input ')'
        { $$ = {tipo: 'INPUT_TEXT', estilos: [], props: $3}; }
    | INPUT_NUMBER estilos_opt '(' props_input ')'
        { $$ = {tipo: 'INPUT_NUMBER', estilos: $2, props: $4}; }
    | INPUT_NUMBER '(' props_input ')'
        { $$ = {tipo: 'INPUT_NUMBER', estilos: [], props: $3}; }
    | INPUT_BOOL estilos_opt '(' props_input ')'
        { $$ = {tipo: 'INPUT_BOOL', estilos: $2, props: $4}; }
    | INPUT_BOOL '(' props_input ')'
        { $$ = {tipo: 'INPUT_BOOL', estilos: [], props: $3}; }
    ;

props_input
    : props_input ',' prop_input { $1.push($3); $$ = $1; }
    | prop_input                 { $$ = [$1]; }
    ;

prop_input
    : PR_ID ':' valor    { $$ = {tipo: 'id',    val: $3}; }
    | PR_LABEL ':' valor { $$ = {tipo: 'label', val: $3}; }
    | PR_VALUE ':' valor { $$ = {tipo: 'value', val: $3}; }
    ;

valor
    : CADENA                     { $$ = {tipo: 'STR',         val: $1}; }
    | VARIABLE '[' NUMERO ']'    { $$ = {tipo: 'ARR_NUM_IDX', id: $1, idx: $3}; }
    | VARIABLE '[' VARIABLE ']'  { $$ = {tipo: 'ARR_VAR_IDX', id: $1, idx: $3}; }
    | VARIABLE                   { $$ = {tipo: 'VAR',         val: $1}; }
    | NUMERO                     { $$ = {tipo: 'NUM',         val: $1}; }
    | TRUE                       { $$ = {tipo: 'BOOL',        val: true}; }
    | FALSE                      { $$ = {tipo: 'BOOL',        val: false}; }
    ;

invocacion_componente
    : IDENTIFICADOR '(' argumentos_opt ')'
        { $$ = {tipo: 'INVOKE', id: $1, args: $3}; }
    ;

argumentos_opt
    : lista_argumentos { $$ = $1; }
    | /* vacío */      { $$ = []; }
    ;

lista_argumentos
    : lista_argumentos ',' argumento { $1.push($3); $$ = $1; }
    | argumento                      { $$ = [$1]; }
    ;

argumento
    : VARIABLE '[' VARIABLE ']'  { $$ = {tipo: 'ARR_VAR_IDX', id: $1, idx: $3}; }
    | VARIABLE '[' NUMERO ']'    { $$ = {tipo: 'ARR_NUM_IDX', id: $1, idx: $3}; }
    | VARIABLE                   { $$ = {tipo: 'VAR',         val: $1}; }
    | CADENA                     { $$ = {tipo: 'STR',         val: $1}; }
    | NUMERO                     { $$ = {tipo: 'NUM',         val: $1}; }
    | TRUE                       { $$ = {tipo: 'BOOL',        val: true}; }
    | FALSE                      { $$ = {tipo: 'BOOL',        val: false}; }
    ;

logica_for
    : FOR EACH '(' VARIABLE ':' VARIABLE ')' '{' elementos '}'
        { $$ = {tipo: 'FOR_EACH', iterador: $4, coleccion: $6, body: $9}; }
    | FOR '(' lista_vars_for ')' TRACK VARIABLE '{' elementos '}' empty_opt
        { $$ = {tipo: 'FOR_TRACK', vars: $3, track: $6, body: $8, empty: $10}; }
    ;

lista_vars_for
    : lista_vars_for ',' VARIABLE ':' VARIABLE { $1.push({iter: $3, col: $5}); $$ = $1; }
    | VARIABLE ':' VARIABLE                    { $$ = [{iter: $1, col: $3}]; }
    ;

empty_opt
    : EMPTY '{' elementos '}' { $$ = $3; }
    | /* vacío */             { $$ = null; }
    ;

logica_if
    : IF '(' expresion ')' '{' elementos '}' lista_elseif else_opt
        { $$ = {tipo: 'IF', cond: $3, body: $6, elseifs: $8, sino: $9}; }
    ;

lista_elseif
    : lista_elseif ELSE IF '(' expresion ')' '{' elementos '}'
        { $1.push({cond: $5, body: $8}); $$ = $1; }
    | /* vacío */
        { $$ = []; }
    ;

else_opt
    : ELSE '{' elementos '}' { $$ = $3; }
    | /* vacío */            { $$ = null; }
    ;

logica_switch
    : SWITCH '(' expresion_switch ')' '{' lista_cases default_opt '}'
        { $$ = {tipo: 'SWITCH', expr: $3, cases: $6, def: $7}; }
    ;

expresion_switch
    : VARIABLE '[' NUMERO ']' { $$ = {tipo: 'ARR_NUM_IDX', id: $1, idx: $3}; }
    | VARIABLE                { $$ = $1; }
    ;

lista_cases
    : lista_cases caso { $1.push($2); $$ = $1; }
    | caso             { $$ = [$1]; }
    ;

caso
    : CASE valor_case '{' elementos '}' ',' { $$ = {val: $2, body: $4}; }
    | CASE valor_case '{' elementos '}'     { $$ = {val: $2, body: $4}; }
    ;

valor_case
    : CADENA { $$ = $1; }
    | NUMERO { $$ = $1; }
    ;

default_opt
    : DEFAULT '{' elementos '}' { $$ = $3; }
    | /* vacío */               { $$ = null; }
    ;

expresion
    : expresion '+'  expresion  { $$ = {op: '+',  izq: $1, der: $3}; }
    | expresion '-'  expresion  { $$ = {op: '-',  izq: $1, der: $3}; }
    | expresion '*'  expresion  { $$ = {op: '*',  izq: $1, der: $3}; }
    | expresion '/'  expresion  { $$ = {op: '/',  izq: $1, der: $3}; }
    | expresion '==' expresion  { $$ = {op: '==', izq: $1, der: $3}; }
    | expresion '!=' expresion  { $$ = {op: '!=', izq: $1, der: $3}; }
    | expresion '<'  expresion  { $$ = {op: '<',  izq: $1, der: $3}; }
    | expresion '<=' expresion  { $$ = {op: '<=', izq: $1, der: $3}; }
    | expresion '>'  expresion  { $$ = {op: '>',  izq: $1, der: $3}; }
    | expresion '>=' expresion  { $$ = {op: '>=', izq: $1, der: $3}; }
    | expresion '&&' expresion  { $$ = {op: '&&', izq: $1, der: $3}; }
    | expresion '||' expresion  { $$ = {op: '||', izq: $1, der: $3}; }
    | '!' expresion             { $$ = {op: '!',  der: $2}; }
    | '-' expresion %prec UMINUS { $$ = {op: 'UMINUS', der: $2}; }
    | '(' expresion ')'         { $$ = $2; }
    | valor                     { $$ = $1; }
    ;