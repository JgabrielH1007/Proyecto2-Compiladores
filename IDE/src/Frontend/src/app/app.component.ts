import { Component, ViewChild, ElementRef } from '@angular/core';
import { ApiService } from './api.service'; // Asegúrate de que esta ruta coincida con la ubicación de tu servicio
import { CommonModule } from '@angular/common';
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
  imports: [CommonModule],    
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'] 
})

export class AppComponent {
  @ViewChild('lineNumbers', { static: false }) lineNumbersRef!: ElementRef<HTMLDivElement>;

  fileSystem: FileSystemNode[] = [
    {
      name: 'src',
      type: 'folder',
      isOpen: true,
      children: [
        { name: 'parser.cup', type: 'file', content: '/* Código del parser */\nterminal ID, NUM;', format: 'cup' },
        { name: 'lexer.flex', type: 'file', content: '/* Código del lexer */\n%%', format: 'flex' },
        { name: 'main.ts', type: 'file', content: 'console.log("Iniciando compilador...");', format: 'ts' }
      ]
    },
    { name: 'README.md', type: 'file', content: '# Proyecto IDE\nInicio del proyecto', format: 'md' }
  ];

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

      await this.readDirectory(dirHandle, rootNode.children!);
      
      this.fileSystem.push(rootNode);
      
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error al abrir el proyecto:', err);
      }
    }
  }

  async readDirectory(dirHandle: any, childrenArray: FileSystemNode[]) {
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
        await this.readDirectory(entry, newFolder.children!);
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
    this.updateHighlighting(); // <-- Disparar coloreo al abrir pestaña
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

  updateCursor(event: any) {
    const textarea = event.target as HTMLTextAreaElement;
    this.editorContent = textarea.value; 
    if (this.activeFile) {
       this.activeFile.content = this.editorContent;
    }

    const textUpToCursor = textarea.value.substring(0, textarea.selectionStart);
    const lines = textUpToCursor.split('\n');
    this.cursorRow = lines.length;
    this.cursorCol = lines[lines.length - 1].length + 1;
    
    this.updateHighlighting(); // <-- Disparar coloreo al teclear
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
  updateHighlighting() {
    if (!this.editorContent) {
      this.highlightedContent = '';
      return;
    }

    // 1. Escapar HTML para no romper el DOM (< y > a &lt; y &gt;)
    let safeCode = this.editorContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Expresión regular con grupos nombrados según la tabla
    const regex = /(?<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(?<keyword>\b(?:import|execute|load|function|main|int|float|string|boolean|char|if|else|switch|case|default|while|do|for|break|continue|TABLE|COLUMNS|IN|DELETE|T|IMG|FORM|SUBMIT|INPUT_TEXT|INPUT_NUMBER|INPUT_BOOL|each|track|empty|extends|from|through|to|base|background|color|border|bottom|top|right|left|padding|margin|radius|width|height|style|text|align|font|size)\b)|(?<literal>\b(?:\d+(?:\.\d+)?|true|false)\b)|(?<bracket>[\{\}\[\]\(\)])|(?<operator>&lt;=|&gt;=|&lt;|&gt;|&amp;&amp;|\|\||==|!=|\+\+|\+|\-|\*|\/|\%|\!|=|@)/gi;

    // 3. Aplicar colores solicitados
    let htmlCode = safeCode.replace(regex, (match, string, keyword, literal, bracket, operator) => {
      if (string) return `<span style="color: #FFA500;">${match}</span>`;     // Naranja
      if (keyword) return `<span style="color: #BA68C8;">${match}</span>`;    // Morado
      if (literal) return `<span style="color: #4DD0E1;">${match}</span>`;    // Celeste
      if (bracket) return `<span style="color: #42A5F5;">${match}</span>`;    // Azul
      if (operator) return `<span style="color: #4CAF50;">${match}</span>`;   // Verde
      return match; 
    });

    // 4. Prevenir salto gráfico de la última línea vacía
    if (htmlCode.endsWith('\n')) {
      htmlCode += ' ';
    }

    this.highlightedContent = this.sanitizer.bypassSecurityTrustHtml(htmlCode);
  }

  get lineNumbers(): number[] {
    const lineCount = this.editorContent.split('\n').length;
    return Array(lineCount).fill(0).map((x, i) => i + 1);
  }

  async exportTree() { //Creo un comprimido .zip del proyecto abierto
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

    // 2. Empezamos a llenar el ZIP desde la raíz de tu fileSystem
    agregarAlZip(this.fileSystem, zip);

    try {
      // 3. Generamos el archivo .zip binario de forma asíncrona
      const blob = await zip.generateAsync({ type: 'blob' });

      // 4. Forzamos la descarga en el navegador
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Proyecto_YFERA.zip'; // Nombre del archivo comprimido
      document.body.appendChild(a); // Necesario en algunos navegadores
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

  analyzeAndTranslate() {
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
    setTimeout(() => this.scrollToBottomTerminal(), 50); 
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
    this.scrollToBottomTerminal();

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
        this.scrollToBottomTerminal();
      },
      error: (err: any) => {
        this.terminalHistory.push({ type: 'error', text: 'Error de conexión con el servidor.' });
        this.scrollToBottomTerminal();
      }
    });
  }

  scrollToBottomTerminal() {
    try {
      if (this.terminalScrollRef) {
        this.terminalScrollRef.nativeElement.scrollTop = this.terminalScrollRef.nativeElement.scrollHeight;
      }
    } catch(err) { }
  }
  // ==========================================
  // GENERACIÓN DE ARCHIVOS TRADUCIDOS
  // ==========================================

  async generarArchivoTraducido(nombreOriginal: string, formatoOriginal: string, contenidoTraducido: string) {
    // 1. Mapear extensión
    let nuevaExtension = '';
    if (formatoOriginal === 'comp') nuevaExtension = 'html';
    else if (formatoOriginal === 'style') nuevaExtension = 'css';
    else if (formatoOriginal === 'y' || formatoOriginal === 'principal') nuevaExtension = 'js';
    else return;

    const nombreSinExtension = nombreOriginal.substring(0, nombreOriginal.lastIndexOf('.'));
    const nuevoNombre = `${nombreSinExtension}.${nuevaExtension}`;

    // 2. Buscar la carpeta padre donde está el archivo actual
    const parentFolder = this.findParentFolder(this.fileSystem, this.activeFile!);
    const targetList = parentFolder && parentFolder.children ? parentFolder.children : this.fileSystem;

    // 3. Revisar si el archivo traducido ya existe en el explorador
    let translatedFile = targetList.find(f => f.name === nuevoNombre && f.type === 'file');

    if (translatedFile) {
      // Si ya existe, solo actualizamos el contenido en memoria
      translatedFile.content = contenidoTraducido;
      
      // Si el usuario lo tiene abierto en una pestaña, actualizamos el editor
      if (this.activeFile === translatedFile) {
        this.editorContent = contenidoTraducido;
      }
    } else {
      // Si no existe, creamos el nodo y lo agregamos al árbol
      translatedFile = {
        name: nuevoNombre,
        type: 'file',
        content: contenidoTraducido,
        format: nuevaExtension
      };
      targetList.push(translatedFile);
    }

    // 4. (Opcional pero increíble) ¡Guardar el archivo físicamente en la computadora!
    await this.guardarArchivoFisico(parentFolder, translatedFile);

    // 5. Abrir automáticamente el archivo traducido en una nueva pestaña
    this.openFile(translatedFile);
  }

  // Busca recursivamente la carpeta que contiene el targetFile
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

  // Usa la API nativa para escribir el archivo directamente en la carpeta local
  async guardarArchivoFisico(parentFolder: FileSystemNode | null, fileNode: FileSystemNode) {
    try {
      // Obtenemos el "Handle" (permiso de la carpeta)
      let dirHandle = parentFolder ? parentFolder.handle : null;
      
      // Si no hay padre, intentamos usar la raíz del proyecto
      if (!dirHandle && this.fileSystem.length > 0) {
        dirHandle = this.fileSystem[0].handle; 
      }

      // Si tenemos permiso de escritura en esa carpeta
      if (dirHandle && dirHandle.kind === 'directory') {
        // Creamos o sobreescribimos el archivo físico
        const fileHandle = await dirHandle.getFileHandle(fileNode.name, { create: true });
        const writable = await fileHandle.createWritable();
        
        await writable.write(fileNode.content || '');
        await writable.close();
        
        // Guardamos el nuevo handle en el nodo por si el usuario lo edita y guarda después
        fileNode.handle = fileHandle; 
        console.log(`¡Archivo físico ${fileNode.name} creado/actualizado con éxito!`);
      }
    } catch (err) {
      console.warn('No se pudo guardar físicamente en disco (solo se guardó en el IDE virtual):', err);
    }
  }
}