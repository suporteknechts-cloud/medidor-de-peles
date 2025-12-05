
export interface MeasurementResult {
  detectedA4: boolean;
  detectedLeather: boolean;
  estimatedAreaSqM: number;
  explanation: string;
  confidenceScore: number; // 0 to 100
  leatherVertices?: {x: number, y: number}[]; // Array of coordinates instead of SVG path string
  a4Outline?: string; // SVG Path string (d attribute) for the A4 paper reference
  isManual?: boolean;
}

export interface MeasurementRecord extends MeasurementResult {
  id: string;
  timestamp: number;
  imageUrl?: string; // Optional: store base64 thumbnail if needed, sticking to ID for now to save storage
  imageName: string;
}

export interface LearningReference {
  imageBase64: string; // Small thumbnail (e.g. 400px) to save tokens
  vertices: {x: number, y: number}[];
}

export enum AppState {
  IDLE = 'IDLE',
  ANALYZING = 'ANALYZING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}
