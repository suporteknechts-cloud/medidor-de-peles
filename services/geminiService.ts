import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MeasurementResult } from "../types";

// Schema for the expected JSON response from Gemini
const measurementSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detectedA4: {
      type: Type.BOOLEAN,
      description: "Whether a standard A4 paper sheet was detected in the image as a reference."
    },
    detectedLeather: {
      type: Type.BOOLEAN,
      description: "Whether a leather skin or hide was detected in the image."
    },
    estimatedAreaSqM: {
      type: Type.NUMBER,
      description: "The precise area of the leather skin in square meters. Calculated using the polygon ratio method."
    },
    explanation: {
      type: Type.STRING,
      description: "A detailed technical explanation in Portuguese (Brazil). Explain how the geometry of the A4 was used to normalize the scale and calculate the leather area."
    },
    confidenceScore: {
      type: Type.NUMBER,
      description: "A confidence score from 0 to 100."
    },
    // OPTIMIZATION: Using a Flat Array [x1, y1, x2, y2...] saves massive token overhead compared to objects.
    leatherVerticesFlat: {
        type: Type.ARRAY,
        description: "A FLAT list of numbers [x1, y1, x2, y2, x3, y3...] representing coordinates on a 1000x1000 grid. Must trace the EXACT organic boundary.",
        items: { type: Type.NUMBER }
    },
    a4Outline: {
        type: Type.STRING,
        description: "The SVG Path string (d attribute) outlining the detected A4 paper on the same 1000x1000 coordinate system. Must be a 4-point polygon."
    }
  },
  required: ["detectedA4", "detectedLeather", "estimatedAreaSqM", "explanation", "confidenceScore", "leatherVerticesFlat", "a4Outline"]
};

export const analyzeLeatherImage = async (base64Image: string): Promise<MeasurementResult> => {
  if (!process.env.API_KEY) {
    throw new Error("Chave de API não configurada (process.env.API_KEY ausente).");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Clean base64 string if it contains metadata header
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");

  let lastError: any;
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview", // Using Pro for maximum reasoning capability regarding texture boundaries
        contents: {
          parts: [
            {
              inlineData: {
                data: cleanBase64,
                mimeType: "image/jpeg" 
              }
            },
            {
              text: `Atue como um Especialista em Visão Computacional de Alta Precisão.

TAREFA:
Realizar a segmentação semântica de uma pele de couro cru.

ESTRATÉGIA DE MAPEAMENTO (EMBALAGEM A VÁCUO):
1. LOCALIZAÇÃO: Primeiro, identifique a "Caixa Delimitadora" (Bounding Box) onde a pele está situada. Ignore completamente o resto do chão fora dessa caixa.
2. TRAÇADO: Gere EXATAMENTE 100 PONTOS de coordenada ao longo da borda da pele.
   - 100 pontos são suficientes para uma curva suave. Não gere mais que isso para evitar alucinações.
3. TEXTURA: A pele tem textura orgânica/rugosa. O chão é liso/concreto. Use essa diferença para achar a borda exata.
4. SOMBRAS: Ignore sombras projetadas. A borda é onde a matéria da pele termina.

SISTEMA DE COORDENADAS:
Normalize tudo para uma grade de 1000x1000.

SAÍDA:
Retorne 'leatherVerticesFlat' como [x1, y1, x2, y2...].`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: measurementSchema,
          temperature: 0.1, // Low temperature for geometric precision
        }
      });

      let text = response.text;
      if (!text) {
        throw new Error("O modelo não retornou nenhum texto.");
      }

      // Clean potential markdown blocks
      if (text.startsWith("```json")) {
          text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (text.startsWith("```")) {
          text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      const rawResult = JSON.parse(text);

      // Convert Flat Array [x1,y1,x2,y2] to Object Array [{x,y}, {x,y}]
      const vertices: {x: number, y: number}[] = [];
      if (rawResult.leatherVerticesFlat && Array.isArray(rawResult.leatherVerticesFlat)) {
          for (let i = 0; i < rawResult.leatherVerticesFlat.length; i += 2) {
              if (rawResult.leatherVerticesFlat[i+1] !== undefined) {
                  vertices.push({
                      x: rawResult.leatherVerticesFlat[i],
                      y: rawResult.leatherVerticesFlat[i+1]
                  });
              }
          }
      }

      const result: MeasurementResult = {
          detectedA4: rawResult.detectedA4,
          detectedLeather: rawResult.detectedLeather,
          estimatedAreaSqM: rawResult.estimatedAreaSqM,
          explanation: rawResult.explanation,
          confidenceScore: rawResult.confidenceScore,
          a4Outline: rawResult.a4Outline,
          leatherVertices: vertices
      };

      return result;

    } catch (error) {
      console.warn(`Tentativa ${attempt + 1} falhou:`, error);
      lastError = error;
      // Wait 1 second before retrying
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.error("Erro na análise da imagem após tentativas:", lastError);
  throw new Error("Falha ao processar a imagem. O servidor está sobrecarregado ou a imagem é muito complexa. Tente novamente.");
};