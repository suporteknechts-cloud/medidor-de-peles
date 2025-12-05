import React, { useState, useRef, useEffect } from 'react';
import { MeasurementResult } from '../types';
import { AlertTriangle, Check, RefreshCw, FileText, Eye, EyeOff, Grid3X3, Edit2, RotateCcw, MousePointer2, PenTool, CheckCircle2, ChevronRight, X, ZoomIn, ZoomOut, Move, Maximize } from 'lucide-react';

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
  
  // EDITING STATE
  const [isEditing, setIsEditing] = useState(isManualMode);
  const [vertices, setVertices] = useState<{x: number, y: number}[]>(result.leatherVertices || []);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [calculatedArea, setCalculatedArea] = useState(result.estimatedAreaSqM);
  
  // ZOOM & PAN STATE
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanMode, setIsPanMode] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize state when result changes (non-manual)
  useEffect(() => {
    if (!isManualMode) {
        setVertices(result.leatherVertices || []);
        setCalculatedArea(result.estimatedAreaSqM);
    }
  }, [result, isManualMode]);

  // SHOELACE FORMULA
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
  
  const getPolygonPath = (points: {x: number, y: number}[]) => {
      if (points.length === 0) return "";
      let path = points.reduce((acc, p, i) => acc + (i === 0 ? "M " : " L ") + `${p.x} ${p.y}`, "");
      if (points.length > 2) path += " Z";
      return path;
  }

  const leatherPathD = getPathFromVertices(vertices);
  const a4PathD = isManualMode ? getPolygonPath(a4Points) : (result.a4Outline || "");

  // --- ZOOM & PAN LOGIC ---
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 5));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 1));
  const handleResetZoom = () => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
  };

  const handleContainerPointerDown = (e: React.PointerEvent) => {
      if (isPanMode) {
          setIsPanning(true);
          panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
      }
  };

  const handleContainerPointerMove = (e: React.PointerEvent) => {
      if (isPanning && isPanMode) {
          setPan({
              x: e.clientX - panStartRef.current.x,
              y: e.clientY - panStartRef.current.y
          });
      }
  };

  const handleContainerPointerUp = (e: React.PointerEvent) => {
      setIsPanning(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // --- SVG INTERACTIONS ---
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

  // UPDATED: Using onPointerDown instead of onClick for more robust touch/click handling
  const handleSvgPointerDown = (e: React.PointerEvent) => {
      // Ignore clicks if we are panning or in Pan Mode
      if (isPanMode) return;
      
      if (!isManualMode || manualStep === 'DONE') return;

      e.preventDefault();
      e.stopPropagation();

      const { x, y } = getSvgCoordinates(e);

      if (manualStep === 'A4') {
          if (a4Points.length < 4) {
              setA4Points([...a4Points, { x, y }]);
          }
      } else if (manualStep === 'LEATHER') {
          setVertices([...vertices, { x, y }]);
      }
  };

  const handlePointPointerDown = (index: number, e: React.PointerEvent) => {
    if (!isEditing || isPanMode || (isManualMode && manualStep !== 'DONE')) return;
    
    e.stopPropagation(); 
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragIndex(index);
  };

  const handlePointPointerMove = (e: React.PointerEvent) => {
    if (dragIndex === null || !svgRef.current) return;
    const { x, y } = getSvgCoordinates(e);
    const newVertices = [...vertices];
    newVertices[dragIndex] = { x, y };
    setVertices(newVertices);
  };

  const handlePointPointerUp = (e: React.PointerEvent) => {
    setDragIndex(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleSaveWrapper = () => {
      const editedResult: MeasurementResult = {
          ...result,
          estimatedAreaSqM: calculatedArea,
          leatherVertices: vertices,
          a4Outline: a4PathD, 
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

  const getCursorStyle = () => {
      if (isPanMode) return isPanning ? 'cursor-grabbing' : 'cursor-grab';
      if (isEditing || (isManualMode && manualStep !== 'DONE')) return 'cursor-crosshair';
      return 'cursor-default';
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-leather-200 overflow-hidden animate-fade-in">
      {/* HEADER */}
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
             
             {/* Manual Instructions */}
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
                                onClick={() => { setVertices(result.leatherVertices || []); setIsEditing(false); handleResetZoom(); }}
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
                
                {/* EDITOR CANVAS WRAPPER */}
                <div 
                    ref={containerRef}
                    className={`relative w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-100 group touch-none select-none h-[500px] lg:h-[650px] flex items-center justify-center`}
                    onPointerDown={handleContainerPointerDown}
                    onPointerMove={handleContainerPointerMove}
                    onPointerUp={handleContainerPointerUp}
                    onPointerLeave={handleContainerPointerUp}
                >
                    {/* ZOOM CONTROLS (Floating) */}
                    {(isEditing || isManualMode) && (
                        <div 
                            className="absolute top-4 right-4 flex flex-col gap-2 bg-white/90 backdrop-blur border border-gray-200 p-1.5 rounded-lg shadow-sm z-20"
                            onPointerDown={(e) => e.stopPropagation()}
                        >
                            <button 
                                onClick={handleZoomIn} 
                                className="p-1.5 hover:bg-gray-100 rounded text-gray-700" 
                                title="Zoom In"
                            >
                                <ZoomIn size={18} />
                            </button>
                            <button 
                                onClick={handleZoomOut} 
                                className="p-1.5 hover:bg-gray-100 rounded text-gray-700" 
                                title="Zoom Out"
                            >
                                <ZoomOut size={18} />
                            </button>
                            <div className="h-px bg-gray-200 my-0.5"></div>
                            <button 
                                onClick={() => setIsPanMode(!isPanMode)} 
                                className={`p-1.5 rounded transition-colors ${isPanMode ? 'bg-cyan-100 text-cyan-700' : 'hover:bg-gray-100 text-gray-700'}`} 
                                title={isPanMode ? "Modo Arrastar (Ativado)" : "Ativar Modo Arrastar"}
                            >
                                <Move size={18} />
                            </button>
                            <button 
                                onClick={handleResetZoom} 
                                className="p-1.5 hover:bg-gray-100 rounded text-gray-700" 
                                title="Resetar Visualização"
                            >
                                <Maximize size={18} />
                            </button>
                        </div>
                    )}

                    {/* TRANSFORMABLE CONTENT */}
                    <div 
                        style={{ 
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                            transformOrigin: 'center center',
                            transition: isPanning ? 'none' : 'transform 0.1s ease-out'
                        }}
                        className={`relative shadow-2xl ${getCursorStyle()}`}
                    >
                        {/* UPDATED: Responsive fixed height image to avoid collapse inside flex container and match larger desktop height */}
                        <img 
                            src={imageBase64} 
                            alt="Analyzed Leather" 
                            className="w-auto object-contain select-none pointer-events-none block h-[480px] lg:h-[630px]"
                            style={{ maxWidth: 'none' }} 
                        />
                        
                        {showOverlay && (
                            <svg 
                                ref={svgRef}
                                viewBox="0 0 1000 1000" 
                                preserveAspectRatio="none"
                                className="absolute top-0 left-0 w-full h-full"
                                style={{ zIndex: 10 }}
                                onPointerDown={handleSvgPointerDown}
                                onPointerMove={(!isPanMode && (isEditing || manualStep === 'DONE')) ? handlePointPointerMove : undefined}
                                onPointerUp={(!isPanMode && (isEditing || manualStep === 'DONE')) ? handlePointPointerUp : undefined}
                                onPointerLeave={(!isPanMode && (isEditing || manualStep === 'DONE')) ? handlePointPointerUp : undefined}
                            >
                                <defs>
                                    <pattern id="leatherTexture" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(15)">
                                        <rect width="60" height="60" fill="rgba(6, 182, 212, 0.05)" />
                                        <path d="M10 10 Q 20 5 30 15" fill="none" stroke="rgba(6, 182, 212, 0.3)" strokeWidth="0.5" strokeLinecap="round" />
                                        <path d="M40 30 Q 35 40 45 50" fill="none" stroke="rgba(6, 182, 212, 0.2)" strokeWidth="0.5" strokeLinecap="round" />
                                    </pattern>
                                </defs>

                                {/* LEATHER LAYER */}
                                {leatherPathD && (
                                    <path 
                                        d={leatherPathD} 
                                        fill={isEditing ? "rgba(6, 182, 212, 0.2)" : "url(#leatherTexture)"}
                                        stroke={isEditing ? "#0891b2" : "#00e5ff"}
                                        strokeWidth={isEditing ? (2 / zoom) : (1.5 / zoom)} // Adjust stroke based on zoom
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
                                        r={isEditing ? (dragIndex === i ? (15 / zoom) : (6 / zoom)) : (1.5 / zoom)}
                                        fill={isEditing ? (dragIndex === i ? "#ffffff" : "#06b6d4") : "#00e5ff"}
                                        stroke={isEditing ? "#0891b2" : "none"}
                                        strokeWidth={isEditing ? (2 / zoom) : 0}
                                        className={(!isPanMode && isEditing && (manualStep === 'DONE' || !isManualMode)) ? "cursor-move" : ""}
                                        style={{ pointerEvents: (!isPanMode && (isEditing || manualStep === 'DONE')) ? 'auto' : 'none' }}
                                        onPointerDown={(e) => handlePointPointerDown(i, e)}
                                    />
                                ))}

                                {/* A4 LAYER */}
                                {a4PathD && (
                                    <path 
                                        d={a4PathD} 
                                        fill="rgba(255, 255, 0, 0.15)" 
                                        stroke="#ffff00" 
                                        strokeWidth={2 / zoom} 
                                        vectorEffect="non-scaling-stroke"
                                        className="drop-shadow-lg pointer-events-none"
                                    />
                                )}
                                {isManualMode && a4Points.map((p, i) => (
                                    <circle key={`a4-${i}`} cx={p.x} cy={p.y} r={8 / zoom} fill="#ffff00" stroke="#000" strokeWidth={1 / zoom} vectorEffect="non-scaling-stroke"/>
                                ))}

                            </svg>
                        )}
                        
                        {/* HELPERS */}
                        {isManualMode && manualStep === 'A4' && (
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/70 text-white px-4 py-2 rounded pointer-events-none text-center" style={{ transform: `scale(${1/zoom})` }}>
                                <Grid3X3 className="mx-auto mb-1 text-yellow-400"/>
                                Clique nos 4 cantos da folha A4
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>
        )}

        {/* DETAILS AND ACTIONS ... (Same as before) */}
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
                            setIsEditing(false);
                            handleResetZoom();
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