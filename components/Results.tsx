
import React, { useState, useRef, useEffect } from 'react';
import { MeasurementResult } from '../types';
import { AlertTriangle, Check, RefreshCw, FileText, Eye, EyeOff, Grid3X3, Edit2, RotateCcw, MousePointer2, PenTool, CheckCircle2, ChevronRight, X } from 'lucide-react';

interface ResultsProps {
  result: MeasurementResult;
  onReset: () => void;
  onSave: (editedResult?: MeasurementResult) => void;
  isSaved: boolean;
  imageBase64: string | null;
}

export const Results: React.FC<ResultsProps> = ({ result, onReset, onSave, isSaved, imageBase64 }) => {
  const isDetectionError = (!result.detectedA4 || !result.detectedLeather) && !result.isManual;
  const [showOverlay, setShowOverlay] = useState(true);
  
  // MANUAL MODE STATES
  const isManualMode = !!result.isManual;
  const [manualStep, setManualStep] = useState<'A4' | 'LEATHER' | 'DONE'>(isManualMode ? 'A4' : 'DONE');
  const [a4Points, setA4Points] = useState<{x: number, y: number}[]>([]);
  
  // EDITING STATE (Used for both AI result editing and Manual Mode drawing)
  // For manual mode, 'isEditing' effectively means "Drawing" or "Editing" depending on step
  const [isEditing, setIsEditing] = useState(isManualMode);
  const [vertices, setVertices] = useState<{x: number, y: number}[]>(result.leatherVertices || []);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [calculatedArea, setCalculatedArea] = useState(result.estimatedAreaSqM);
  
  const svgRef = useRef<SVGSVGElement>(null);

  // Initialize state when result changes (non-manual)
  useEffect(() => {
    if (!isManualMode) {
        setVertices(result.leatherVertices || []);
        setCalculatedArea(result.estimatedAreaSqM);
    }
  }, [result, isManualMode]);

  // SHOELACE FORMULA to calculate polygon area in "Unit Coordinates" (0-1000)
  const getPolygonArea = (points: {x: number, y: number}[]) => {
    let area = 0;
    const n = points.length;
    if (n < 3) return 0;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        area += points[i].x * points[j].y;
        area -= points[j].x * points[i].y;
    }
    return Math.abs(area) / 2;
  };

  // Recalculate Real Area (m2)
  useEffect(() => {
    // MANUAL MODE CALCULATION
    if (isManualMode) {
        if (a4Points.length < 3 || vertices.length < 3) {
            setCalculatedArea(0);
            return;
        }
        const a4UnitArea = getPolygonArea(a4Points);
        const leatherUnitArea = getPolygonArea(vertices);
        
        if (a4UnitArea > 0) {
            const A4_REAL_AREA_M2 = 0.06237; // 210mm * 297mm
            const scaleFactor = A4_REAL_AREA_M2 / a4UnitArea;
            setCalculatedArea(leatherUnitArea * scaleFactor);
        }
    } 
    // AI MODE RECALCULATION
    else if (result.leatherVertices && result.leatherVertices.length > 0) {
        const originalUnitArea = getPolygonArea(result.leatherVertices);
        const currentUnitArea = getPolygonArea(vertices);

        if (originalUnitArea > 0) {
            const scaleFactor = result.estimatedAreaSqM / originalUnitArea;
            const newArea = currentUnitArea * scaleFactor;
            setCalculatedArea(newArea);
        }
    }
  }, [vertices, a4Points, isManualMode, result.estimatedAreaSqM, result.leatherVertices]);


  const getPathFromVertices = (points: {x: number, y: number}[]) => {
    if (points.length === 0) return "";
    return points.reduce((acc, p, i) => 
        acc + (i === 0 ? "M " : " L ") + `${p.x} ${p.y}`, ""
    ) + " Z";
  };
  
  // Used for A4 Manual Polygon
  const getPolygonPath = (points: {x: number, y: number}[]) => {
      if (points.length === 0) return "";
      let path = points.reduce((acc, p, i) => acc + (i === 0 ? "M " : " L ") + `${p.x} ${p.y}`, "");
      if (points.length > 2) path += " Z";
      return path;
  }

  const leatherPathD = getPathFromVertices(vertices);
  const a4PathD = isManualMode ? getPolygonPath(a4Points) : (result.a4Outline || "");

  // MOUSE INTERACTIONS
  const getSvgCoordinates = (e: React.PointerEvent | React.MouseEvent) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const svgRect = svgRef.current.getBoundingClientRect();
      const scaleX = 1000 / svgRect.width;
      const scaleY = 1000 / svgRect.height;
      let x = (e.clientX - svgRect.left) * scaleX;
      let y = (e.clientY - svgRect.top) * scaleY;
      x = Math.max(0, Math.min(1000, x));
      y = Math.max(0, Math.min(1000, y));
      return { x, y };
  }

  const handleSvgClick = (e: React.MouseEvent) => {
      // Logic for adding points in manual mode
      if (!isManualMode || manualStep === 'DONE') return;

      const { x, y } = getSvgCoordinates(e);

      if (manualStep === 'A4') {
          if (a4Points.length < 4) {
              const newPoints = [...a4Points, { x, y }];
              setA4Points(newPoints);
              if (newPoints.length === 4) {
                  // Auto-advance logic could go here, but let's let user confirm visual
              }
          }
      } else if (manualStep === 'LEATHER') {
          setVertices([...vertices, { x, y }]);
      }
  };

  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    // Logic for dragging points (Edit Mode)
    if (!isEditing || (isManualMode && manualStep !== 'DONE')) return;
    
    e.stopPropagation(); // Prevent triggering svg click
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIndex(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null || !svgRef.current) return;
    const { x, y } = getSvgCoordinates(e);
    const newVertices = [...vertices];
    newVertices[dragIndex] = { x, y };
    setVertices(newVertices);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setDragIndex(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleSaveWrapper = () => {
      const editedResult: MeasurementResult = {
          ...result,
          estimatedAreaSqM: calculatedArea,
          leatherVertices: vertices,
          a4Outline: a4PathD, // Save the manual A4 path too
          isManual: isManualMode
      };
      onSave(editedResult);
  };

  const undoLastPoint = () => {
      if (manualStep === 'A4') {
          setA4Points(prev => prev.slice(0, -1));
      } else if (manualStep === 'LEATHER') {
          setVertices(prev => prev.slice(0, -1));
      }
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-leather-200 overflow-hidden animate-fade-in">
      {/* HEADER / STATUS BAR */}
      <div className={`p-6 text-center text-white transition-colors duration-300 ${isDetectionError ? 'bg-red-600' : isEditing || isManualMode ? 'bg-cyan-700' : 'bg-leather-700'}`}>
        {isDetectionError ? (
           <>
             <AlertTriangle className="mx-auto mb-2" size={48} />
             <h2 className="text-2xl font-bold">Erro de Detecção</h2>
           </>
        ) : (
           <>
             <p className="text-leather-200 text-sm uppercase tracking-widest font-semibold mb-1">
                 {isManualMode ? 'Modo Manual' : isEditing ? 'Editando' : 'Área Calculada'}
             </p>
             <div className="text-6xl font-bold tracking-tight">
               {calculatedArea.toFixed(3)}
               <span className="text-2xl ml-2 font-normal opacity-70">m²</span>
             </div>
             
             {/* Manual Mode Instructions */}
             {isManualMode && manualStep === 'A4' && (
                 <p className="text-sm bg-yellow-500/20 text-yellow-100 py-1 px-3 rounded-full inline-block mt-2 font-medium">
                     Passo 1: Clique nos 4 cantos da folha A4 ({a4Points.length}/4)
                 </p>
             )}
             {isManualMode && manualStep === 'LEATHER' && (
                 <p className="text-sm bg-cyan-500/20 text-cyan-100 py-1 px-3 rounded-full inline-block mt-2 font-medium">
                     Passo 2: Clique ao redor da pele para traçar ({vertices.length} pontos)
                 </p>
             )}
             {isManualMode && manualStep === 'DONE' && (
                 <p className="text-sm text-cyan-200 mt-2">Traçado finalizado. Arraste os pontos para ajustar.</p>
             )}
           </>
        )}
      </div>

      <div className="p-6">
        {imageBase64 && !isDetectionError && (
            <div className="mb-8">
                {/* TOOLBAR */}
                <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
                    <h3 className="text-sm font-semibold text-gray-700 uppercase flex items-center gap-2">
                        {isManualMode ? <PenTool size={16} className="text-cyan-600"/> : <Grid3X3 size={16} />} 
                        {isManualMode ? 'Traçado Manual' : isEditing ? 'Editor de Pontos' : 'Mapeamento de Precisão'}
                    </h3>
                    
                    <div className="flex gap-2">
                        {/* MANUAL CONTROLS */}
                        {isManualMode && manualStep !== 'DONE' && (
                            <>
                                <button onClick={undoLastPoint} className="text-xs px-3 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium">
                                    Desfazer Ponto
                                </button>
                                {manualStep === 'A4' && a4Points.length === 4 && (
                                    <button onClick={() => setManualStep('LEATHER')} className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-1">
                                        Próximo <ChevronRight size={14}/>
                                    </button>
                                )}
                                {manualStep === 'LEATHER' && vertices.length > 2 && (
                                    <button onClick={() => setManualStep('DONE')} className="text-xs px-3 py-1.5 rounded bg-green-600 hover:bg-green-700 text-white font-medium flex items-center gap-1">
                                        Finalizar <CheckCircle2 size={14}/>
                                    </button>
                                )}
                            </>
                        )}

                        {/* EDIT MODE CONTROLS (NON-MANUAL) */}
                        {!isManualMode && !isEditing && (
                            <button 
                                onClick={() => { setIsEditing(true); setShowOverlay(true); }}
                                className="text-xs flex items-center gap-1 text-white bg-cyan-600 hover:bg-cyan-700 transition-colors px-3 py-1.5 rounded font-medium shadow-sm"
                            >
                                <Edit2 size={14}/> Editar Pontos
                            </button>
                        )}
                        {!isManualMode && isEditing && (
                             <button 
                                onClick={() => { setVertices(result.leatherVertices || []); setIsEditing(false); }}
                                className="text-xs flex items-center gap-1 text-red-600 bg-red-50 hover:bg-red-100 transition-colors px-3 py-1.5 rounded border border-red-200"
                            >
                                <RotateCcw size={14}/> Cancelar
                            </button>
                        )}

                        <button 
                            onClick={() => setShowOverlay(!showOverlay)}
                            className={`text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded border
                                ${isEditing || isManualMode ? 'opacity-50 cursor-not-allowed text-gray-400 border-gray-100' : 'text-leather-600 hover:text-leather-800 bg-leather-50 border-leather-100'}`}
                        >
                            {showOverlay ? <><EyeOff size={14}/> Ocultar</> : <><Eye size={14}/> Mostrar</>}
                        </button>
                    </div>
                </div>
                
                {/* EDITOR CANVAS */}
                <div className="relative w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group touch-none select-none">
                    <img 
                        src={imageBase64} 
                        alt="Analyzed Leather" 
                        className="w-full h-auto block select-none pointer-events-none"
                    />
                    
                    {showOverlay && (
                        <svg 
                            ref={svgRef}
                            viewBox="0 0 1000 1000" 
                            preserveAspectRatio="none"
                            className={`absolute top-0 left-0 w-full h-full ${(isEditing || (isManualMode && manualStep !== 'DONE')) ? 'cursor-crosshair' : 'pointer-events-none'}`}
                            style={{ zIndex: 10 }}
                            onClick={handleSvgClick}
                            onPointerMove={(isEditing || manualStep === 'DONE') ? handlePointerMove : undefined}
                            onPointerUp={(isEditing || manualStep === 'DONE') ? handlePointerUp : undefined}
                            onPointerLeave={(isEditing || manualStep === 'DONE') ? handlePointerUp : undefined}
                        >
                            <defs>
                                <pattern id="leatherTexture" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
                                    <rect width="60" height="60" fill="rgba(6, 182, 212, 0.05)" />
                                    <path d="M10 10 Q 20 5 30 15" fill="none" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="0.5" strokeLinecap="round" />
                                    <path d="M40 30 Q 35 40 45 50" fill="none" stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5" strokeLinecap="round" />
                                </pattern>
                            </defs>

                            {/* --- LEATHER LAYER --- */}
                            {leatherPathD && (
                                <path 
                                    d={leatherPathD} 
                                    fill={isEditing ? "rgba(6, 182, 212, 0.2)" : "url(#leatherTexture)"}
                                    stroke={isEditing ? "#0891b2" : "#00e5ff"}
                                    strokeWidth={isEditing ? "2" : "1.5"}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    vectorEffect="non-scaling-stroke"
                                    className="drop-shadow-sm transition-colors"
                                />
                            )}
                             {vertices.map((p, i) => (
                                <circle 
                                    key={`v-${i}`} 
                                    cx={p.x} 
                                    cy={p.y} 
                                    r={isEditing ? (dragIndex === i ? 15 : 6) : 1.5}
                                    fill={isEditing ? (dragIndex === i ? "#ffffff" : "#06b6d4") : "#00e5ff"}
                                    stroke={isEditing ? "#0891b2" : "none"}
                                    strokeWidth={isEditing ? 2 : 0}
                                    vectorEffect="non-scaling-stroke"
                                    className={isEditing && (manualStep === 'DONE' || !isManualMode) ? "cursor-move" : ""}
                                    style={{ pointerEvents: (isEditing || manualStep === 'DONE') ? 'auto' : 'none' }}
                                    onPointerDown={(e) => handlePointerDown(i, e)}
                                />
                            ))}

                            {/* --- A4 LAYER --- */}
                            {a4PathD && (
                                <path 
                                    d={a4PathD} 
                                    fill="rgba(255, 255, 0, 0.15)" 
                                    stroke="#ffff00" 
                                    strokeWidth="2" 
                                    vectorEffect="non-scaling-stroke"
                                    className="drop-shadow-lg pointer-events-none"
                                />
                            )}
                            {isManualMode && a4Points.map((p, i) => (
                                <circle key={`a4-${i}`} cx={p.x} cy={p.y} r={8} fill="#ffff00" stroke="#000" strokeWidth={1} vectorEffect="non-scaling-stroke"/>
                            ))}

                        </svg>
                    )}
                    
                    {/* HELPERS */}
                    {isManualMode && manualStep === 'A4' && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-4 py-2 rounded pointer-events-none text-center">
                            <Grid3X3 className="mx-auto mb-1 text-yellow-400"/>
                            Clique nos 4 cantos da folha A4
                        </div>
                    )}
                    
                </div>
            </div>
        )}

        {/* DETAILS PANEL */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Dados da Medição</h3>
            <ul className="space-y-2">
              <li className="flex items-center justify-between">
                <span className="text-gray-700">Vértices da Pele</span>
                <span className="text-sm font-bold text-gray-700">{vertices.length}</span>
              </li>
              <li className="flex items-center justify-between">
                  <span className="text-gray-700">Método</span>
                  <span className={`text-sm font-bold flex items-center gap-1 ${isManualMode ? 'text-blue-600' : 'text-purple-600'}`}>
                      {isManualMode ? 'Manual' : 'Automático (IA)'}
                  </span>
              </li>
            </ul>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
             <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Análise</h3>
             <p className="text-sm text-gray-600 leading-relaxed italic">
               "{result.explanation}"
             </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
                onClick={onReset}
                disabled={isEditing && isManualMode && manualStep !== 'DONE'}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg transition-colors font-medium shadow-sm hover:bg-gray-50"
            >
                <RefreshCw size={18} />
                Nova Medição
            </button>
            
            {!isDetectionError && (
                <button
                    onClick={() => {
                        if (isEditing) {
                            setIsEditing(false); // Always exit edit mode first
                        } else {
                            handleSaveWrapper();
                        }
                    }}
                    disabled={(isSaved && !isEditing) || (isManualMode && manualStep !== 'DONE')}
                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg transition-colors font-medium shadow-sm text-white
                        ${isEditing || (isManualMode && manualStep !== 'DONE') ? 'bg-cyan-600 hover:bg-cyan-700' : 
                          isSaved ? 'bg-green-600 hover:bg-green-700 opacity-90 cursor-default' : 'bg-leather-600 hover:bg-leather-700'}
                        ${(isManualMode && manualStep !== 'DONE') ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    {isEditing ? <Check size={18} /> : isSaved ? <Check size={18} /> : <FileText size={18} />}
                    {isEditing ? 'Concluir Edição' : isSaved ? 'Salvo no Histórico' : 'Salvar Resultado'}
                </button>
            )}
        </div>
      </div>
    </div>
  );
};
