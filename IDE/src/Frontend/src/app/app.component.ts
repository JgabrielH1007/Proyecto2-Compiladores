import { Component, ViewChild, ElementRef } from '@angular/core';
import { ApiService } from './api.service'; // Asegúrate de que esta ruta coincida con la ubicación de tu servicio
import { CommonModule } from '@angular/common';

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

  // Constructor inyectando el servicio API
  constructor(private apiService: ApiService) {}

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
  }

  syncScroll(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    if (this.lineNumbersRef) {
      this.lineNumbersRef.nativeElement.scrollTop = textarea.scrollTop;
    }
  }

  get lineNumbers(): number[] {
    const lineCount = this.editorContent.split('\n').length;
    return Array(lineCount).fill(0).map((x, i) => i + 1);
  }

  exportTree() {
    const treeJson = JSON.stringify(this.fileSystem, null, 2);
    console.log("Árbol exportado:\n", treeJson);
    
    const blob = new Blob([treeJson], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace-tree.json';
    a.click();
    window.URL.revokeObjectURL(url);
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
            if(formato === 'db') {
              //ejecutar codigo sql lite
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
    alert('Abriendo panel de terminal...');
  }
}