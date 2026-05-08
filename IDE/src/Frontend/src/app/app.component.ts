import { Component, ViewChild, ElementRef } from '@angular/core';
import { ApiService } from './api.service'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import JSZip from 'jszip';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

export interface FileSystemNode {
  name: string;
  type: 'file' | 'folder';
  content?: string;
  format?: string;
  isOpen?: boolean; 
  children?: FileSystemNode[];
  handle?: any;
}

@Component({
  selector: 'app-root',
  standalone: true,           
  imports: [CommonModule, FormsModule],  
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'] 
})

export class AppComponent {
  @ViewChild('lineNumbersContainer', { static: false }) lineNumbersRef!: ElementRef<HTMLDivElement>;

  fileSystem: FileSystemNode[] = [];

  openTabs: FileSystemNode[] = [];
  activeFile: FileSystemNode | null = null;
  editorContent: string = '';

  cursorRow: number = 1;
  cursorCol: number = 1;
  listaErrores: any[] = [];
  mostrarErrores: boolean = false;
  @ViewChild('terminalScroll', { static: false }) terminalScrollRef!: ElementRef<HTMLDivElement>;
  mostrarTerminal: boolean = false;
  terminalHistory: { type: 'command' | 'output' | 'error', text: string }[] = [
    { type: 'output', text: 'YFERA IDE Terminal iniciada. Listo para comandos DBASE.' }
  ];

  highlightedContent: SafeHtml = ''; // <-- NUEVA VARIABLE

  constructor(private apiService: ApiService, private sanitizer: DomSanitizer) {}

  onNodeClick(node: FileSystemNode) {
    if (node.type === 'folder') {
      node.isOpen = !node.isOpen;
    } else {
      this.openFile(node);
    }
  }

  async openProject() {
    try {
      // Verificamos el navegador 
      if (!('showDirectoryPicker' in window)) {
        alert('Tu navegador no soporta la lectura de carpetas locales. Usa Chrome o Edge.');
        return;
      }

      const dirHandle = await (window as any).showDirectoryPicker();
      
      this.fileSystem = []; 
      
      const rootNode: FileSystemNode = {
        name: dirHandle.name,
        type: 'folder',
        isOpen: true,
        children: [],
        handle: dirHandle
      };

      await this.leerDireccion(dirHandle, rootNode.children!);
      
      this.fileSystem.push(rootNode);
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error al abrir el proyecto:', err);
      }
    }
  }

  async leerDireccion(dirHandle: any, childrenArray: FileSystemNode[]) {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        childrenArray.push({
          name: entry.name,
          type: 'file',
          format: entry.name.split('.').pop() || 'txt',
          handle: entry
        });
      } else if (entry.kind === 'directory') {
        const newFolder: FileSystemNode = {
          name: entry.name,
          type: 'folder',
          isOpen: false,
          children: [],
          handle: entry
        };
        childrenArray.push(newFolder);
        await this.leerDireccion(entry, newFolder.children!);
      }
    }

    childrenArray.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });
  }

  async openFile(file: FileSystemNode) {
    if (file.type !== 'file') return;
    
    if (file.handle && file.content === undefined) {
      try {
        const fileData = await file.handle.getFile();
        file.content = await fileData.text(); // extrayendo texto jaja
      } catch (err) {
        console.error("Error al leer el archivo físico:", err);
        file.content = "// Error: No se pudo leer el archivo. (Puede que sea un binario o imagen)";
      }
    }

    if (!this.openTabs.includes(file)) {
      this.openTabs.push(file);
    }
    this.selectTab(file);
  }

  selectTab(file: FileSystemNode) {
    this.activeFile = file;
    this.editorContent = file.content || '';
    this.actualizarColoreado(); 
  }

  closeTab(file: FileSystemNode, event: Event) {
    event.stopPropagation();
    this.openTabs = this.openTabs.filter(f => f !== file);
    if (this.activeFile === file) {
      this.activeFile = this.openTabs.length > 0 ? this.openTabs[this.openTabs.length - 1] : null;
      this.editorContent = this.activeFile ? (this.activeFile.content || '') : '';
    }
  }

  createFile(parentFolder?: FileSystemNode, event?: Event) {
    if (event) event.stopPropagation(); 

    const fileName = prompt('Nombre del nuevo archivo:');
    if (!fileName) return;

    const extension = fileName.includes('.') ? fileName.split('.').pop() : 'principal';

    const newFile: FileSystemNode = { name: fileName, type: 'file', content: '', format: extension };

    if (parentFolder && parentFolder.children) {
      parentFolder.children.push(newFile);
      parentFolder.isOpen = true;
    } else {
      this.fileSystem.push(newFile);
    }
    this.openFile(newFile);
  }

  createFolder(parentFolder?: FileSystemNode, event?: Event) {
    if (event) event.stopPropagation();

    const folderName = prompt('Nombre de la nueva carpeta:');
    if (!folderName) return;

    const newFolder: FileSystemNode = { name: folderName, type: 'folder', isOpen: true, children: [] };

    if (parentFolder && parentFolder.children) {
      parentFolder.children.push(newFolder);
      parentFolder.isOpen = true;
    } else {
      this.fileSystem.push(newFolder);
    }
  }

  saveProyect() {
    console.log('Guardando proyecto...', this.fileSystem);
  }

  updateCursor(event?: any) {
    if (this.activeFile) {
       this.activeFile.content = this.editorContent;
    }

    if (event && event.target) {
      const textarea = event.target as HTMLTextAreaElement;
      const textUpToCursor = textarea.value.substring(0, textarea.selectionStart);
      const lines = textUpToCursor.split('\n');
      this.cursorRow = lines.length;
      this.cursorCol = lines[lines.length - 1].length + 1;
    }
    
    this.actualizarColoreado();
  }
  syncScroll(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    if (this.lineNumbersRef) {
      this.lineNumbersRef.nativeElement.scrollTop = textarea.scrollTop;
    }
    // NUEVO: Sincronizar scroll del código a color
    const highlightLayer = document.querySelector('.editor-highlight') as HTMLElement;
    if (highlightLayer) {
      highlightLayer.scrollTop = textarea.scrollTop;
      highlightLayer.scrollLeft = textarea.scrollLeft;
    }
  }
  actualizarColoreado() {
    if (!this.editorContent) {
      this.highlightedContent = '';
      return;
    }
    let safeCode = this.editorContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const regex = /(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?<keyword>\b(?:import|execute|load|function|main|int|float|string|boolean|char|if|else|switch|case|default|while|do|for|break|continue|TABLE|COLUMNS|IN|DELETE|T|IMG|FORM|SUBMIT|INPUT_TEXT|INPUT_NUMBER|INPUT_BOOL|each|track|empty|extends|from|through|to|base|background|color|border|bottom|top|right|left|padding|margin|radius|width|height|style|text|align|font|size)\b)|(?<literal>\b(?:\d+(?:\.\d+)?|true|false)\b)|(?<bracket>[\{\}\[\]\(\)])|(?<operator>&lt;=|&gt;=|&lt;|&gt;|&amp;&amp;|\|\||==|!=|\+\+|\+|\-|\*|\/|\%|\!|=|@)/gi;

    let htmlCode = safeCode.replace(regex, (match, string, keyword, literal, bracket, operator) => {
      if (string) return `<span style="color: #FFA500;">${match}</span>`;     // Naranja
      if (keyword) return `<span style="color: #BA68C8;">${match}</span>`;    // Morado
      if (literal) return `<span style="color: #4DD0E1;">${match}</span>`;    // Celeste
      if (bracket) return `<span style="color: #42A5F5;">${match}</span>`;    // Azul
      if (operator) return `<span style="color: #4CAF50;">${match}</span>`;   // Verde
      return match; 
    });

    if (htmlCode.endsWith('\n')) {
      htmlCode += ' ';
    }

    this.highlightedContent = this.sanitizer.bypassSecurityTrustHtml(htmlCode);
  }

  get lineNumbers(): number[] {
    const lineCount = this.editorContent.split('\n').length;
    return Array(lineCount).fill(0).map((x, i) => i + 1);
  }

  async exportarProyecto() { //Creo un comprimido .zip del proyecto abierto
    if (!this.fileSystem || this.fileSystem.length === 0) {
      alert('El árbol de trabajo está vacío.');
      return;
    }

    console.log("Comprimiendo el proyecto...");
    const zip = new JSZip();

    const agregarAlZip = (nodos: FileSystemNode[], carpetaZip: JSZip) => {
      for (const nodo of nodos) {
        if (nodo.type === 'folder') {
          const subCarpeta = carpetaZip.folder(nodo.name);
          if (nodo.children && subCarpeta) {
            agregarAlZip(nodo.children, subCarpeta);
          }
        } else if (nodo.type === 'file') {
          carpetaZip.file(nodo.name, nodo.content || '');
        }
      }
    };

    agregarAlZip(this.fileSystem, zip);

    try {
      const blob = await zip.generateAsync({ type: 'blob' });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Proyecto_YFERA.zip'; 
      document.body.appendChild(a); 
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      console.log("¡Proyecto exportado exitosamente!");
    } catch (error) {
      console.error("Error al generar el archivo ZIP:", error);
      alert("Hubo un error al comprimir el proyecto.");
    }
  }

  togglePreview() {
    alert('Función de Vista Previa activada. (Requiere implementación del panel derecho)');
  }

  analizarYTraducir() {
    if (!this.activeFile) {
      alert('No hay ningún archivo abierto para analizar.');
      return;
    }

    const contenido = this.activeFile.content;
    
    if (!contenido || contenido.trim() === '') {
      alert('El archivo está vacío.');
      return;
    }

    console.log(`Iniciando análisis del archivo: ${this.activeFile.name}`);
    
    let formato = 'y';
    if (this.activeFile.name.includes('.')) {
      formato = this.activeFile.name.split('.').pop() || 'y'; 
    }
    
    this.listaErrores = [];
    this.mostrarErrores = false;

    this.apiService.enviarCodigo(contenido, formato).subscribe({
        next: (respuesta: any) => {
          console.log("Respuesta del servidor:", respuesta);
          
          if (respuesta.exito) {
            alert("¡Análisis exitoso! No se encontraron errores.");
            
            if (formato === 'db' || formato === 'dbase') {
              // La base de datos se ejecuta directamente, no crea archivo
              console.log("Script de base de datos procesado.");
            } else {
              // LLAMADA AL CREADOR DE ARCHIVOS
              this.generarArchivoTraducido(this.activeFile!.name, formato, respuesta.resultado);
            }

          } else {
            this.listaErrores = respuesta.errores.map((err: any) => {
              const tipoError = err.tipo ? err.tipo : (err.esperados ? 'Sintáctico' : 'Léxico');
              const mensaje = err.mensaje ? err.mensaje : (err.esperados ? `Se esperaba: ${err.esperados.join(', ')}` : 'Caracter no reconocido por el lenguaje');

              return {
                tipo: tipoError,
                linea: err.linea || err.fila || 0,
                columna: err.columna || 0,
                texto: err.texto || err.lexema || 'N/A',
                mensaje: mensaje
              };
            });
            this.mostrarErrores = true;
          }
        },
        error: (err: any) => {
          console.error("Error de conexión con el backend:", err);
          alert("No se pudo conectar con el servidor Node.js.");
        }
      });
  }

  cerrarErrores() {
    this.mostrarErrores = false;
  }
  openTerminal() {
    this.mostrarTerminal = true;
    setTimeout(() => this.scrollTerminal(), 50); 
  }

  cerrarTerminal() {
    this.mostrarTerminal = false;
  }

  ejecutarComandoTerminal(event: any) {
    const inputElement = event.target as HTMLInputElement;
    const comando = inputElement.value.trim();
    
    if (!comando) return;

    this.terminalHistory.push({ type: 'command', text: comando });
    inputElement.value = ''; 
    this.scrollTerminal();

    this.apiService.enviarCodigo(comando, 'dbase').subscribe({
      next: (respuesta: any) => {
        if (respuesta.exito) {
          const salida = respuesta.resultado ? 
                         (typeof respuesta.resultado === 'object' ? JSON.stringify(respuesta.resultado, null, 2) : respuesta.resultado) 
                         : 'Comando traducido/ejecutado exitosamente (Sin salida).';
          
          this.terminalHistory.push({ type: 'output', text: salida });
        } else {
          this.terminalHistory.push({ type: 'error', text: 'Error: Revisa la sintaxis de tu comando.' });
        }
        this.scrollTerminal();
      },
      error: (err: any) => {
        this.terminalHistory.push({ type: 'error', text: 'Error de conexión con el servidor.' });
        this.scrollTerminal();
      }
    });
  }

  scrollTerminal() {
    try {
      if (this.terminalScrollRef) {
        this.terminalScrollRef.nativeElement.scrollTop = this.terminalScrollRef.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }

  async generarArchivoTraducido(nombreOriginal: string, formatoOriginal: string, contenidoTraducido: string) {
    let nuevaExtension = '';
    if (formatoOriginal === 'comp') nuevaExtension = 'html';
    else if (formatoOriginal === 'style') nuevaExtension = 'css';
    else if (formatoOriginal === 'y' || formatoOriginal === 'principal') nuevaExtension = 'js';
    else return;

    const nombreSinExtension = nombreOriginal.substring(0, nombreOriginal.lastIndexOf('.'));
    const nuevoNombre = `${nombreSinExtension}.${nuevaExtension}`;

    const parentFolder = this.findParentFolder(this.fileSystem, this.activeFile!);
    const targetList = parentFolder && parentFolder.children ? parentFolder.children : this.fileSystem;

    let translatedFile = targetList.find(f => f.name === nuevoNombre && f.type === 'file');

    if (translatedFile) {
      translatedFile.content = contenidoTraducido;
      
      if (this.activeFile === translatedFile) {
        this.editorContent = contenidoTraducido;
      }
    } else {
      translatedFile = {
        name: nuevoNombre,
        type: 'file',
        content: contenidoTraducido,
        format: nuevaExtension
      };
      targetList.push(translatedFile);
    }

    await this.guardarArchivoFisico(parentFolder, translatedFile);

    this.openFile(translatedFile);
  }

  findParentFolder(nodes: FileSystemNode[], targetFile: FileSystemNode): FileSystemNode | null {
    for (const node of nodes) {
      if (node.type === 'folder' && node.children) {
        if (node.children.includes(targetFile)) {
          return node;
        }
        const found = this.findParentFolder(node.children, targetFile);
        if (found) return found;
      }
    }
    return null;
  }

  async guardarArchivoFisico(parentFolder: FileSystemNode | null, fileNode: FileSystemNode) {
    try {
      let dirHandle = parentFolder ? parentFolder.handle : null;
      if (!dirHandle && this.fileSystem.length > 0) {
        dirHandle = this.fileSystem[0].handle; 
      }

      if (dirHandle && dirHandle.kind === 'directory') {
        const fileHandle = await dirHandle.getFileHandle(fileNode.name, { create: true });
        const writable = await fileHandle.createWritable();
        
        await writable.write(fileNode.content || '');
        await writable.close();
        
        fileNode.handle = fileHandle; 
        console.log(`¡Archivo físico ${fileNode.name} creado/actualizado con éxito!`);
      }
    } catch (err) {
      console.warn('No se pudo guardar físicamente en disco (solo se guardó en el IDE virtual):', err);
    }
  }

  indentadoAutomatico(event: KeyboardEvent) {
    const textarea = event.target as HTMLTextAreaElement;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 1. MANEJO DE LA TECLA TAB
    if (event.key === 'Tab') {
      event.preventDefault(); // Evita que el navegador cambie de foco
      const spaces = '    '; // 4 espacios

      // Insertamos los espacios donde está el cursor
      this.editorContent = this.editorContent.substring(0, start) + spaces + this.editorContent.substring(end);
      if (this.activeFile) this.activeFile.content = this.editorContent;

      // Movemos el cursor 4 posiciones adelante
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + spaces.length;
        this.actualizarColoreado();
        this.updateCursor({ target: textarea });
      }, 0);
    }

    // 2. MANEJO DE LA TECLA ENTER (Auto-Indentado)
    if (event.key === 'Enter') {
      event.preventDefault(); // Evita el salto de línea por defecto

      // Obtenemos todo el texto antes del cursor
      const textBeforeCursor = this.editorContent.substring(0, start);
      const linesBefore = textBeforeCursor.split('\n');
      const currentLine = linesBefore[linesBefore.length - 1]; // La línea donde estamos dando Enter

      // Extraemos los espacios en blanco que hay al inicio de la línea actual
      const leadingSpacesMatch = currentLine.match(/^\s*/);
      let spacesToInsert = leadingSpacesMatch ? leadingSpacesMatch[0] : '';

      // Si la línea actual termina en {, [, o (, agregamos un nivel extra de indentación
      if (currentLine.trim().match(/[\{\[\(]$/)) {
        spacesToInsert += '    ';
      }

      // Creamos el salto de línea + los espacios calculados
      const insertString = '\n' + spacesToInsert;

      // Insertamos esto en el texto
      this.editorContent = this.editorContent.substring(0, start) + insertString + this.editorContent.substring(end);
      if (this.activeFile) this.activeFile.content = this.editorContent;

      // Movemos el cursor justo después de los espacios insertados
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + insertString.length;
        this.actualizarColoreado();
        this.updateCursor({ target: textarea });
      }, 0);
    }
  }

}