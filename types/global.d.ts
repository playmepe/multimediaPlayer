// Definiciones globales para tu proyecto
declare module '*.json' {
    const value: any;
    export default value;
}

// Extensiones para módulos sin tipos
declare module 'fluent-ffmpeg' {
    const value: any;
    export default value;
}

declare module 'electron-store' {
    const value: any;
    export default value;
}

// Tipos globales de la aplicación
interface BibleVerse {
    book: string;
    chapter: number;
    verse: number;
    text: string;
}

interface MediaItem {
    id: string;
    title: string;
    path: string;
    type: 'audio' | 'video' | 'image';
}

interface DisplayConfig {
    id: string;
    name: string;
    bounds: Electron.Rectangle;
    isPrimary: boolean;
}
