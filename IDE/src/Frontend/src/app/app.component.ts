import { Component, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common'; // Necesario para standalone components

interface FileDef {
  name: string;
  content: string;
}

@Component({
  selector: 'app-root',
  standalone: true,           // SOLUCIÓN AL ERROR NG0907
  imports: [CommonModule],    // Permite usar *ngIf y *ngFor
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  // Referencia al contenedor de los números de línea en el HTML
  @ViewChild('lineNumbers', { static: false }) lineNumbersRef!: ElementRef<HTMLDivElement>;

  files: FileDef[] = [
    { name: 'parser.cup', content: '/* Código del parser */\nterminal ID, NUM;' },
    { name: 'lexer.flex', content: '/* Código del lexer */\n%%' },
    { name: 'main.ts', content: 'console.log("Iniciando compilador...");' }
  ];

  openTabs: FileDef[] = [];
  activeFile: FileDef | null = null;
  editorContent: string = '';

  cursorRow: number = 1;
  cursorCol: number = 1;

  openFile(file: FileDef) {
    if (!this.openTabs.includes(file)) {
      this.openTabs.push(file);
    }
    this.selectTab(file);
  }

  selectTab(file: FileDef) {
    this.activeFile = file;
    this.editorContent = file.content;
  }

  closeTab(file: FileDef, event: Event) {
    event.stopPropagation();
    this.openTabs = this.openTabs.filter(f => f !== file);
    if (this.activeFile === file) {
      this.activeFile = this.openTabs.length > 0 ? this.openTabs[this.openTabs.length - 1] : null;
      this.editorContent = this.activeFile ? this.activeFile.content : '';
    }
  }

  createFile() {
    const fileName = prompt('Nombre del nuevo archivo:');
    if (fileName) {
      const newFile = { name: fileName, content: '' };
      this.files.push(newFile);
      this.openFile(newFile);
    }
  }

  createProject() {
    alert('Lógica para crear una nueva carpeta/proyecto iría aquí.');
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

  // NUEVA FUNCIÓN: Sincroniza el scroll vertical
  syncScroll(event: Event) {
    const textarea = event.target as HTMLTextAreaElement;
    if (this.lineNumbersRef) {
      // Iguala la posición de scroll del div de números con la del textarea
      this.lineNumbersRef.nativeElement.scrollTop = textarea.scrollTop;
    }
  }

  get lineNumbers(): number[] {
    const lineCount = this.editorContent.split('\n').length;
    return Array(lineCount).fill(0).map((x, i) => i + 1);
  }
}