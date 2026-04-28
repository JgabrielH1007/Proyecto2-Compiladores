class TraductorSQL {

    static traducir(ast) {
        if (!ast || !Array.isArray(ast)) return [];
        
        const sentenciasSQL = [];
        
        for (const instruccion of ast) {
            try {
                const sql = this.procesarInstruccion(instruccion);
                if (sql) sentenciasSQL.push(sql);
            } catch (error) {
                throw new Error(`Error en traducción: ${error.message}`);
            }
        }
        
        return sentenciasSQL;
    }

    static procesarInstruccion(nodo) {
        switch (nodo.tipo) {
            case 'CREATE':
                return this.traducirCreate(nodo);
            case 'SELECT_COL':
                return this.traducirSelectCol(nodo);
            case 'INSERT':
                return this.traducirInsert(nodo);
            case 'UPDATE':
                return this.traducirUpdate(nodo);
            case 'DELETE':
                return this.traducirDelete(nodo);
            default:
                throw new Error(`Tipo de instrucción no reconocido: ${nodo.tipo}`);
        }
    }

    static traducirCreate(nodo) {
        const mapeoTipos = {
            'int': 'INTEGER',
            'string': 'TEXT',
            'char': 'TEXT',
            'float': 'REAL',
            'boolean': 'INTEGER' 
        };

        const definicionColumnas = nodo.cols.map(col => {
            const tipoSQLite = mapeoTipos[col.tipo] || 'TEXT';
            return `${col.id} ${tipoSQLite}`;
        }).join(', ');

        let columnasSQL = definicionColumnas;
        if (!columnasSQL.toLowerCase().includes(' id ')) {
            columnasSQL = `_rowid INTEGER PRIMARY KEY AUTOINCREMENT, ` + columnasSQL;
        }

        return `CREATE TABLE IF NOT EXISTS ${nodo.tabla} (${columnasSQL});`;
    }

    static traducirSelectCol(nodo) {
        return `SELECT ${nodo.col} FROM ${nodo.tabla};`;
    }

    static traducirInsert(nodo) {
        const columnas = nodo.data.map(asignacion => asignacion.col).join(', ');
        const valores = nodo.data.map(asignacion => this.evaluarExpresion(asignacion.val)).join(', ');

        return `INSERT INTO ${nodo.tabla} (${columnas}) VALUES (${valores});`;
    }

    static traducirUpdate(nodo) {
        const asignaciones = nodo.data.map(asignacion => {
            const valor = this.evaluarExpresion(asignacion.val);
            return `${asignacion.col} = ${valor}`;
        }).join(', ');

        return `UPDATE ${nodo.tabla} SET ${asignaciones} WHERE _rowid = ${nodo.id};`;
    }

    static traducirDelete(nodo) {
        return `DELETE FROM ${nodo.tabla} WHERE _rowid = ${nodo.id};`;
    }

    static evaluarExpresion(expr) {
        if (expr && expr.op) {
            if (expr.izq) {
                const izq = this.evaluarExpresion(expr.izq);
                const der = this.evaluarExpresion(expr.der);
                return `(${izq} ${expr.op} ${der})`;
            } else {
                return `-${this.evaluarExpresion(expr.der)}`;
            }
        }
        
        if (expr === 'true') return '1';
        if (expr === 'false') return '0';
        
        return expr;
    }
}

module.exports = TraductorSQL;