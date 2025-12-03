
import React from 'react';
import { FileText, Trash2, Calendar } from 'lucide-react';
import { MeasurementRecord } from '../types';

interface HistoryListProps {
  history: MeasurementRecord[];
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
  onExport: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ history, onClearHistory, onDeleteItem, onExport }) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-leather-100">
        <div className="mx-auto w-16 h-16 bg-leather-50 rounded-full flex items-center justify-center mb-4 text-leather-300">
          <Calendar size={32} />
        </div>
        <h3 className="text-lg font-medium text-leather-900">Sem medições anteriores</h3>
        <p className="text-gray-500">Realize sua primeira medição para ver o histórico aqui.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-leather-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-leather-100 flex justify-between items-center bg-leather-50">
        <h2 className="font-bold text-leather-900">Histórico de Medições</h2>
        <div className="flex gap-2">
            <button 
                onClick={onExport}
                className="text-sm px-3 py-1.5 bg-leather-600 text-white rounded-md hover:bg-leather-700 flex items-center gap-1 transition-colors shadow-sm"
            >
                <FileText size={14} /> Exportar PDF
            </button>
            <button 
                onClick={onClearHistory}
                className="text-sm px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md flex items-center gap-1 transition-colors border border-transparent hover:border-red-100"
            >
                <Trash2 size={14} /> Limpar Tudo
            </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-leather-500 uppercase bg-leather-50/50">
            <tr>
              <th className="px-6 py-3">Data</th>
              <th className="px-6 py-3">Arquivo</th>
              <th className="px-6 py-3">Área (m²)</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {history.map((record) => (
              <tr key={record.id} className="bg-white border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4">
                  {new Date(record.timestamp).toLocaleDateString('pt-BR')} <br/>
                  <span className="text-xs text-gray-400">{new Date(record.timestamp).toLocaleTimeString('pt-BR')}</span>
                </td>
                <td className="px-6 py-4 font-medium text-gray-900 truncate max-w-[150px]">
                  {record.imageName}
                </td>
                <td className="px-6 py-4 font-bold text-leather-700 text-base">
                  {record.estimatedAreaSqM.toFixed(3)} m²
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold
                    ${record.confidenceScore > 80 ? 'bg-green-100 text-green-800' : 
                      record.confidenceScore > 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                    {record.detectedA4 ? "Sucesso" : "Alerta"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                    <button 
                        onClick={() => onDeleteItem(record.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Excluir medição"
                    >
                        <Trash2 size={16} />
                    </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
