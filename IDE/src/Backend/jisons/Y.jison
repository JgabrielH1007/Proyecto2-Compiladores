/* Analizador lexico del lenguaje principal */
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

\s+                             /* ignorar espacios */
\/\*[\s\S]*?\*\/                /* ignorar comentarios multilínea */
"#".*                           /* ignorar comentarios de línea */

"=="                            return '==';
"!="                            return '!=';
"<="                            return '<=';
">="                            return '>=';
"&&"                            return '&&';
"||"                            return '||';

[a-zA-Z_][a-zA-Z0-9_]* {
    var keywords = {
        'import'    : 'IMPORT',
        'execute'   : 'EXECUTE',
        'load'      : 'LOAD',
        'function'  : 'FUNCTION',
        'main'      : 'MAIN',
        'int'       : 'TYPE_INT',
        'float'     : 'TYPE_FLOAT',
        'string'    : 'TYPE_STRING',
        'boolean'   : 'TYPE_BOOLEAN',
        'char'      : 'TYPE_CHAR',
        'True'      : 'TRUE',
        'False'     : 'FALSE',
        'if'        : 'IF',
        'else'      : 'ELSE',
        'switch'    : 'SWITCH',
        'case'      : 'CASE',
        'default'   : 'DEFAULT',
        'while'     : 'WHILE',
        'do'        : 'DO',
        'for'       : 'FOR',
        'break'     : 'BREAK',
        'continue'  : 'CONTINUE',
    };
    return keywords[yytext] || 'IDENTIFICADOR';
}

\"([^\"\\]|\\.)*\"              return 'CADENA';
\'([^\'\\]|\\.)\'               return 'CARACTER';
\`([^\`\\]|\\.)*\`              return 'QUERY_SQL';
[0-9]+"."[0-9]+                 return 'NUM_FLOAT';
[0-9]+                          return 'NUM_INT';

"@"                             return '@';
";"                             return ';';
","                             return ',';
":"                             return ':';
"="                             return '=';
"{"                             return '{';
"}"                             return '}';
"["                             return '[';
"]"                             return ']';
"("                             return '(';
")"                             return ')';
"+"                             return '+';
"-"                             return '-';
"*"                             return '*';
"/"                             return '/';
"%"                             return '%';
"!"                             return '!';
"<"                             return '<';
">"                             return '>';

<<EOF>>                         return 'EOF';
.                               { return 'INVALID'; }

/lex

%left '||'
%left '&&'
%left '==' '!='
%left '<' '<=' '>' '>='
%left '+' '-'
%left '*' '/' '%'
%right '!' UMINUS

%start inicio

%%

inicio
    : programa EOF { return $1; }
    ;

programa
    : lista_imports lista_declaraciones lista_funciones MAIN '{' instrucciones_main '}'
        { $$ = { tipo: 'PROGRAMA', imports: $1, globales: $2, funciones: $3, main: $6 }; }
    | error EOF
        { $$ = { tipo: 'PROGRAMA', imports: [], globales: [], funciones: [], main: [] }; }
    ;

lista_imports
    : lista_imports IMPORT CADENA ';'
        { $1.push({ tipo: 'IMPORT', ruta: $3 }); $$ = $1; }
    | lista_imports error ';'
        { $$ = $1; }
    | /* vacío */ { $$ = []; }
    ;

lista_declaraciones
    : lista_declaraciones declaracion
        { $1.push($2); $$ = $1; }
    | lista_declaraciones error ';'
        { $$ = $1; }
    | /* vacío */ { $$ = []; }
    ;

declaracion
    : tipo IDENTIFICADOR '=' expresion ';'
        { $$ = { tipo: 'DECLARACION', tipoDato: $1, id: $2, valor: $4 }; }
    | tipo IDENTIFICADOR ';'
        { $$ = { tipo: 'DECLARACION', tipoDato: $1, id: $2, valor: null }; }
    | tipo '[' ']' IDENTIFICADOR '=' '[' NUM_INT ']' ';'
        { $$ = { tipo: 'DECLARACION_ARR_VACIO', tipoDato: $1, id: $4, size: Number($7) }; }
    | tipo '[' ']' IDENTIFICADOR '=' '{' lista_expresiones '}' ';'
        { $$ = { tipo: 'DECLARACION_ARR', tipoDato: $1, id: $4, valores: $7 }; }
    | tipo '[' ']' IDENTIFICADOR '=' EXECUTE QUERY_SQL ';'
        { $$ = { tipo: 'DECLARACION_ARR_DB', tipoDato: $1, id: $4, query: $7 }; }
    | tipo '[' ']' IDENTIFICADOR '=' EXECUTE QUERY_SQL
        { $$ = { tipo: 'DECLARACION_ARR_DB', tipoDato: $1, id: $4, query: $7 }; }
    ;

tipo
    : TYPE_INT     { $$ = 'int'; }
    | TYPE_FLOAT   { $$ = 'float'; }
    | TYPE_STRING  { $$ = 'string'; }
    | TYPE_BOOLEAN { $$ = 'boolean'; }
    | TYPE_CHAR    { $$ = 'char'; }
    ;

lista_funciones
    : lista_funciones funcion { $1.push($2); $$ = $1; }
    | lista_funciones error '}' { $$ = $1; }
    | /* vacío */             { $$ = []; }
    ;

funcion
    : FUNCTION IDENTIFICADOR '(' parametros_opt ')' '{' instrucciones_funcion '}'
        { $$ = { tipo: 'FUNCION', id: $2, params: $4, body: $7 }; }
    ;

parametros_opt
    : lista_parametros { $$ = $1; }
    | /* vacío */      { $$ = []; }
    ;

lista_parametros
    : lista_parametros ',' tipo IDENTIFICADOR { $1.push({ tipoDato: $3, id: $4 }); $$ = $1; }
    | tipo IDENTIFICADOR                      { $$ = [{ tipoDato: $1, id: $2 }]; }
    ;

instrucciones_funcion
    : instrucciones_funcion instruccion_funcion
        { $1.push($2); $$ = $1; }
    | instrucciones_funcion error ';'
        { $$ = $1; }
    | /* vacío */ { $$ = []; }
    ;

instruccion_funcion
    : EXECUTE QUERY_SQL ';'  { $$ = { tipo: 'EXECUTE', query: $2 }; }
    | LOAD CADENA ';'        { $$ = { tipo: 'LOAD', ruta: $2 }; }
    | LOAD IDENTIFICADOR ';' { $$ = { tipo: 'LOAD', ruta: $2 }; }
    ;

instrucciones_main
    : instrucciones_main instruccion_main
        { $1.push($2); $$ = $1; }
    | instrucciones_main error ';'
        { $$ = $1; }
    | instrucciones_main error '}'
        { yyless(0); $$ = $1; }
    | /* vacío */ { $$ = []; }
    ;

instruccion_main
    : declaracion           { $$ = $1; }
    | invocacion_componente { $$ = $1; }
    | asignacion            { $$ = $1; }
    | llamada_funcion       { $$ = $1; }
    | logica_if             { $$ = $1; }
    | logica_switch         { $$ = $1; }
    | logica_while          { $$ = $1; }
    | logica_do_while       { $$ = $1; }
    | logica_for            { $$ = $1; }
    | BREAK ';'             { $$ = { tipo: 'BREAK' }; }
    | CONTINUE ';'          { $$ = { tipo: 'CONTINUE' }; }
    ;

llamada_funcion
    : IDENTIFICADOR '(' lista_expresiones_opt ')' ';'
        { $$ = { tipo: 'LLAMADA_FUNCION', id: $1, args: $3 }; }
    ;

invocacion_componente
    : '@' IDENTIFICADOR '(' lista_expresiones_opt ')' ';'
        { $$ = { tipo: 'COMPONENTE_CALL', id: $2, args: $4 }; }
    ;

asignacion
    : IDENTIFICADOR '=' expresion ';'
        { $$ = { tipo: 'ASIGNACION', id: $1, valor: $3 }; }
    | IDENTIFICADOR '[' expresion ']' '=' expresion ';'
        { $$ = { tipo: 'ASIGNACION_ARR', id: $1, indice: $3, valor: $6 }; }
    ;

logica_if
    : IF '(' expresion ')' '{' instrucciones_main '}' lista_elseif else_opt
        { $$ = { tipo: 'IF', cond: $3, body: $6, elseifs: $8, sino: $9 }; }
    ;

lista_elseif
    : lista_elseif ELSE IF '(' expresion ')' '{' instrucciones_main '}'
        { $1.push({ cond: $5, body: $8 }); $$ = $1; }
    | /* vacío */ { $$ = []; }
    ;

else_opt
    : ELSE '{' instrucciones_main '}' { $$ = $3; }
    | /* vacío */                     { $$ = null; }
    ;

logica_switch
    : SWITCH '(' expresion ')' '{' lista_cases default_opt '}'
        { $$ = { tipo: 'SWITCH', expr: $3, cases: $6, def: $7 }; }
    ;

lista_cases
    : lista_cases CASE expresion ':' instrucciones_main
        { $1.push({ val: $3, body: $5 }); $$ = $1; }
    | CASE expresion ':' instrucciones_main
        { $$ = [{ val: $2, body: $4 }]; }
    ;

default_opt
    : DEFAULT ':' instrucciones_main { $$ = $3; }
    | /* vacío */                    { $$ = null; }
    ;

logica_while
    : WHILE '(' expresion ')' '{' instrucciones_main '}'
        { $$ = { tipo: 'WHILE', cond: $3, body: $6 }; }
    ;

logica_do_while
    : DO '{' instrucciones_main '}' WHILE '(' expresion ')' ';'
        { $$ = { tipo: 'DO_WHILE', body: $3, cond: $7 }; }
    ;

logica_for
    : FOR '(' asignacion_for ';' expresion ';' asignacion_for_step ')' '{' instrucciones_main '}'
        { $$ = { tipo: 'FOR', init: $3, cond: $5, step: $7, body: $10 }; }
    ;

asignacion_for
    : tipo IDENTIFICADOR '=' expresion { $$ = { tipo: 'DECLARACION', tipoDato: $1, id: $2, valor: $4 }; }
    | IDENTIFICADOR '=' expresion      { $$ = { tipo: 'ASIGNACION', id: $1, valor: $3 }; }
    | /* vacío */                      { $$ = null; }
    ;

asignacion_for_step
    : IDENTIFICADOR '=' expresion { $$ = { tipo: 'ASIGNACION', id: $1, valor: $3 }; }
    | expresion                   { $$ = $1; }
    | /* vacío */                 { $$ = null; }
    ;

lista_expresiones_opt
    : lista_expresiones { $$ = $1; }
    | /* vacío */       { $$ = []; }
    ;

lista_expresiones
    : lista_expresiones ',' expresion { $1.push($3); $$ = $1; }
    | expresion                       { $$ = [$1]; }
    ;

expresion
    : expresion '+'  expresion    { $$ = { op: '+',  izq: $1, der: $3 }; }
    | expresion '-'  expresion    { $$ = { op: '-',  izq: $1, der: $3 }; }
    | expresion '*'  expresion    { $$ = { op: '*',  izq: $1, der: $3 }; }
    | expresion '/'  expresion    { $$ = { op: '/',  izq: $1, der: $3 }; }
    | expresion '%'  expresion    { $$ = { op: '%',  izq: $1, der: $3 }; }
    | expresion '==' expresion    { $$ = { op: '==', izq: $1, der: $3 }; }
    | expresion '!=' expresion    { $$ = { op: '!=', izq: $1, der: $3 }; }
    | expresion '<'  expresion    { $$ = { op: '<',  izq: $1, der: $3 }; }
    | expresion '<=' expresion    { $$ = { op: '<=', izq: $1, der: $3 }; }
    | expresion '>'  expresion    { $$ = { op: '>',  izq: $1, der: $3 }; }
    | expresion '>=' expresion    { $$ = { op: '>=', izq: $1, der: $3 }; }
    | expresion '&&' expresion    { $$ = { op: '&&', izq: $1, der: $3 }; }
    | expresion '||' expresion    { $$ = { op: '||', izq: $1, der: $3 }; }
    | '!' expresion               { $$ = { op: '!',      der: $2 }; }
    | '-' expresion %prec UMINUS  { $$ = { op: 'UMINUS', der: $2 }; }
    | '(' expresion ')'           { $$ = $2; }
    | IDENTIFICADOR '[' expresion ']' { $$ = { tipo: 'ACCESO_ARR', id: $1, indice: $3 }; }
    | IDENTIFICADOR               { $$ = { tipo: 'ID', val: $1 }; }
    | NUM_INT                     { $$ = Number($1); }
    | NUM_FLOAT                   { $$ = Number($1); }
    | CADENA                      { $$ = $1; }
    | CARACTER                    { $$ = $1; }
    | TRUE                        { $$ = true; }
    | FALSE                       { $$ = false; }
    ;