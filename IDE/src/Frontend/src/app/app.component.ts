import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';

// 1. Nueva estructura jerárquica
export interface FileSystemNode {
  name: string;
  type: 'file' | 'folder';
  content?: string;
  format?: string;
  isOpen?: boolean; // Para saber si la carpeta está expandida
  children?: FileSystemNode[];
  handle?: any;
}

@Component({
  selector: 'app-root',
  standalone: true,           
  imports: [CommonModule],    
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'] // Corregido de scss a css según tus archivos
})
export class AppComponent {
  @ViewChild('lineNumbers', { static: false }) lineNumbersRef!: ElementRef<HTMLDivElement>;

  // 2. Sistema de archivos estructurado en árbol
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

  // Lógica para el clic en el árbol
  onNodeClick(node: FileSystemNode) {
    if (node.type === 'folder') {
      node.isOpen = !node.isOpen; // Alternar expansión de la carpeta
    } else {
      this.openFile(node);
    }
  }

  async openProject() {
    try {
      // Verificamos si el navegador soporta esta API (Chrome, Edge, Opera)
      if (!('showDirectoryPicker' in window)) {
        alert('Tu navegador no soporta la lectura de carpetas locales. Usa Chrome o Edge.');
        return;
      }

      // Abre la ventana para seleccionar carpeta
      const dirHandle = await (window as any).showDirectoryPicker();
      
      // Reiniciamos el árbol
      this.fileSystem = []; 
      
      // Creamos el nodo raíz del proyecto
      const rootNode: FileSystemNode = {
        name: dirHandle.name,
        type: 'folder',
        isOpen: true,
        children: [],
        handle: dirHandle
      };

      // Leemos el contenido recursivamente
      await this.readDirectory(dirHandle, rootNode.children!);
      
      // Agregamos el proyecto a la vista
      this.fileSystem.push(rootNode);
      
    } catch (err: any) {
      // El usuario canceló la ventana o denegó los permisos
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
          handle: entry // Guardamos la referencia, pero NO leemos el contenido aún
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
        // Llamada recursiva para leer subcarpetas
        await this.readDirectory(entry, newFolder.children!);
      }
    }

    // Ordenamos alfabéticamente: primero carpetas, luego archivos
    childrenArray.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });
  }

  async openFile(file: FileSystemNode) {
    if (file.type !== 'file') return;
    
    // Si el archivo viene del disco duro y aún no tiene contenido, lo leemos
    if (file.handle && file.content === undefined) {
      try {
        const fileData = await file.handle.getFile();
        file.content = await fileData.text(); // Extraemos el texto
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

  // Crear archivo (en la raíz o dentro de una carpeta)
  createFile(parentFolder?: FileSystemNode, event?: Event) {
    if (event) event.stopPropagation(); // Evitar que la carpeta se cierre al hacer clic en el botón

    const fileName = prompt('Nombre del nuevo archivo:');
    if (!fileName) return;

    const newFile: FileSystemNode = { name: fileName, type: 'file', content: '', format: 'txt' };

    if (parentFolder && parentFolder.children) {
      parentFolder.children.push(newFile);
      parentFolder.isOpen = true; // Asegurar que la carpeta se abra para ver el archivo
    } else {
      this.fileSystem.push(newFile);
    }
    this.openFile(newFile);
  }

  // Crear carpeta (en la raíz o dentro de una carpeta)
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

  createProject() {
    const projectName = prompt('Nombre del nuevo proyecto:');
    if(projectName) {
      this.fileSystem = []; // Limpiar árbol para proyecto nuevo
      // Lógica extra para iniciar proyecto
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
    // Convierte el sistema de archivos a JSON para exportarlo
    const treeJson = JSON.stringify(this.fileSystem, null, 2);
    console.log("Árbol exportado:\n", treeJson);
    
    // Opcional: Crear un archivo descargable automáticamente
    const blob = new Blob([treeJson], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workspace-tree.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  togglePreview() {
    // Aquí puedes implementar la lógica para abrir un panel derecho con la vista previa
    // Por ahora, lanzamos una alerta
    alert('Función de Vista Previa activada. (Requiere implementación del panel derecho)');
  }

  analyzeAndTranslate() {
    if (!this.activeFile) {
      alert('No hay ningún archivo abierto para analizar.');
      return;
    }
    
    console.log(`Iniciando análisis del archivo: ${this.activeFile.name}`);
    console.log('Contenido a analizar:\n', this.activeFile.content);
    
    // Aquí conectarías con tu backend o parser (Jison, Cup, etc.)
    alert('Análisis y traducción en progreso. Revisa la consola.');
  }

  openTerminal() {
    alert('Abriendo panel de terminal...');
    // Más adelante aquí cambiaremos una variable booleana como this.showTerminal = !this.showTerminal;
  }
}

