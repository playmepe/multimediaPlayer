// Tipos extendidos para Electron
export interface IPCChannels {
  // Comandos del reproductor
  'player:play': string;
  'player:pause': void;
  'player:stop': void;
  'player:seek': number;
  'player:volume': number;

  // Biblia
  'bible:verse': BibleVerse;
  'bible:search': string;

  // Pantallas
  'display:list': void;
  'display:select': string;

  // Configuración
  'config:get': string;
  'config:set': { key: string; value: any };
}

export type IPCMainHandler = {
  [K in keyof IPCChannels]: (
    event: Electron.IpcMainEvent,
    data: IPCChannels[K]
  ) => void;
};

export type IPCRendererHandler = {
  [K in keyof IPCChannels]: (
    data: IPCChannels[K]
  ) => Promise<any>;
};
