
import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { Instructions } from './components/Instructions';
import { Results } from './components/Results';
import { HistoryList } from './components/HistoryList';
import { analyzeLeatherImage } from './services/geminiService';
import { AppState, MeasurementRecord, MeasurementResult } from './types';
import { Upload, Loader2, AlertCircle, PenTool } from 'lucide-react';

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [currentResult, setCurrentResult] = useState<MeasurementResult | null>(null);
  const [currentImageBase64, setCurrentImageBase64] = useState<string | null>(null);
  
  // FIX: Lazy initialization to prevent overwriting localStorage with empty array on mount
  const [history, setHistory] = useState<MeasurementRecord[]>(() => {
    const stored = localStorage.getItem('leather_history');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error("Failed to parse history", e);
        return [];
      }
    }
    return [];
  });

  const [showHistory, setShowHistory] = useState(false);
  const [currentImageName, setCurrentImageName] = useState<string>('');
  const [isSaved, setIsSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Save history to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem('leather_history', JSON.stringify(history));
  }, [history]);

  const processImage = (file: File, callback: (base64: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = async () => {
            // Resize logic
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            const MAX_WIDTH = 1000;
            const MAX_HEIGHT = 1000;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }

            canvas.width = width;
            canvas.height = height;

            if (ctx) {
                // APPLY IMAGE ENHANCEMENT
                ctx.filter = "contrast(1.2) saturate(1.1)";
                ctx.drawImage(img, 0, 0, width, height);
                const resizedBase64 = canvas.toDataURL('image/jpeg', 0.9);
                callback(resizedBase64);
            }
        };
        img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
        setErrorMsg("O arquivo é muito grande. O limite é 10MB.");
        return;
    }

    setAppState(AppState.ANALYZING);
    setCurrentImageName(file.name);
    setErrorMsg(null);
    setIsSaved(false);

    processImage(file, async (resizedBase64) => {
        setCurrentImageBase64(resizedBase64);
        try {
            const result = await analyzeLeatherImage(resizedBase64);
            setCurrentResult(result);
            setAppState(AppState.SUCCESS);
        } catch (error: any) {
            setErrorMsg(error.message || "Erro desconhecido ao processar imagem.");
            setAppState(AppState.ERROR);
        }
    });
  };

  const handleManualUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      
      setCurrentImageName(file.name);
      setErrorMsg(null);
      setIsSaved(false);

      processImage(file, (resizedBase64) => {
          setCurrentImageBase64(resizedBase64);
          // Initialize empty manual result
          setCurrentResult({
              detectedA4: true,
              detectedLeather: true,
              estimatedAreaSqM: 0,
              explanation: "Medição manual realizada pelo usuário.",
              confidenceScore: 100,
              isManual: true,
              leatherVertices: [],
              a4Outline: ""
          });
          setAppState(AppState.SUCCESS);
      });
  };

  // UPDATED: Now accepts optional editedResult
  const handleSave = (editedResult?: MeasurementResult) => {
    const resultToSave = editedResult || currentResult;

    if (!resultToSave) return;
    
    // If we received an edited result, ensure we update the current view state too
    if (editedResult) {
        setCurrentResult(editedResult);
    }

    const newRecord: MeasurementRecord = {
      ...resultToSave,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      imageName: currentImageName
    };

    setHistory(prev => [newRecord, ...prev]);
    setIsSaved(true);
  };

  const handleClearHistory = () => {
    if (window.confirm("Tem certeza que deseja limpar todo o histórico?")) {
      setHistory([]);
    }
  };

  const handleDeleteItem = (id: string) => {
      if (window.confirm("Deseja realmente excluir esta medição?")) {
          setHistory(prev => prev.filter(item => item.id !== id));
      }
  };

  const handleExportPDF = () => {
    // Access jsPDF from global window object injected by the script tag
    const jsPDF = (window as any).jspdf?.jsPDF;
    
    if (!jsPDF) {
        alert("Erro: Biblioteca PDF não carregada. Tente recarregar a página.");
        return;
    }

    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.setTextColor(125, 81, 61); // Leather color
    doc.text("Medidor de Pele - Relatório de Medições", 14, 22);
    
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 30);

    // Prepare table data
    const tableColumn = ["Data", "Arquivo", "Área (m²)", "Confiança", "Status A4"];
    const tableRows: any[] = [];

    history.forEach(record => {
        const recordData = [
            new Date(record.timestamp).toLocaleDateString('pt-BR'),
            record.imageName,
            record.estimatedAreaSqM.toFixed(4) + ' m²',
            record.confidenceScore + '%',
            record.detectedA4 ? "OK" : "Erro"
        ];
        tableRows.push(recordData);
    });

    if ((doc as any).autoTable) {
        (doc as any).autoTable({
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [125, 81, 61], textColor: 255 }, // Leather brown
            alternateRowStyles: { fillColor: [247, 242, 237] } // Leather light theme
        });
        doc.save("historico_medicoes_couro.pdf");
    } else {
        alert("Erro: Plugin de Tabela não carregado.");
    }
  };

  const handleReset = useCallback(() => {
    setAppState(AppState.IDLE);
    setCurrentResult(null);
    setCurrentImageBase64(null);
    setErrorMsg(null);
    setCurrentImageName('');
  }, []);

  const renderContent = () => {
    if (showHistory) {
      return (
        <HistoryList 
          history={history} 
          onClearHistory={handleClearHistory} 
          onDeleteItem={handleDeleteItem}
          onExport={handleExportPDF}
        />
      );
    }

    switch (appState) {
      case AppState.ANALYZING:
        return (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
            <Loader2 className="h-16 w-16 text-leather-600 animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-gray-800">Analisando Imagem...</h2>
            <p className="text-gray-500 mt-2 text-center max-w-md">Aplicando filtros de contraste e mapeando geometria...</p>
          </div>
        );
      
      case AppState.SUCCESS:
        return currentResult ? (
          <Results 
            result={currentResult} 
            onReset={handleReset}
            onSave={handleSave}
            isSaved={isSaved}
            imageBase64={currentImageBase64}
          />
        ) : null;

      case AppState.ERROR:
        return (
          <div className="flex flex-col items-center justify-center py-16 bg-red-50 rounded-xl border border-red-100">
            <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
            <h3 className="text-lg font-bold text-red-800 mb-2">Ops! Algo deu errado</h3>
            <p className="text-red-600 mb-6 text-center px-4">{errorMsg}</p>
            <button 
              onClick={handleReset}
              className="px-6 py-2 bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-50 font-medium"
            >
              Tentar Novamente
            </button>
          </div>
        );

      case AppState.IDLE:
      default:
        return (
          <div className="space-y-8 animate-fade-in">
            <Instructions />
            
            <div className="bg-white p-8 rounded-xl shadow-lg border border-leather-100 text-center hover:border-leather-300 transition-colors">
              <div className="mb-6 mx-auto bg-leather-50 w-20 h-20 rounded-full flex items-center justify-center text-leather-600">
                <Upload size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Carregar Foto da Pele</h2>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                Tire uma foto clara da pele com uma folha A4 ao lado para calibração.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <label className="inline-flex cursor-pointer bg-leather-600 hover:bg-leather-700 text-white font-bold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all justify-center items-center gap-2">
                    <Upload size={20} />
                    <span>Automático (IA)</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleFileUpload}
                    />
                  </label>

                  <label className="inline-flex cursor-pointer bg-white border-2 border-leather-600 text-leather-700 hover:bg-leather-50 font-bold py-3 px-8 rounded-lg shadow-sm hover:shadow-md transform hover:-translate-y-0.5 transition-all justify-center items-center gap-2">
                    <PenTool size={20} />
                    <span>Modo Manual</span>
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={handleManualUpload}
                    />
                  </label>
              </div>
              <p className="mt-4 text-xs text-gray-400">Suporta JPG, PNG (Max 10MB)</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f2ed] font-sans text-gray-800 pb-12">
      <Header 
        onShowHistory={() => setShowHistory(true)} 
        onGoHome={() => setShowHistory(false)}
      />

      <main className="max-w-4xl mx-auto px-4 py-8">
        {renderContent()}
      </main>
    </div>
  );
}
