import React from 'react';
import { CheckCircle, Camera, Contrast, Sun, Layers } from 'lucide-react';

export const Instructions: React.FC = () => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-leather-100 p-6 mb-8">
      <h2 className="text-lg font-bold text-leather-900 mb-4 flex items-center gap-2">
        <Camera size={20} />
        Instruções para Alta Precisão
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-blue-600 bg-blue-50 p-1 rounded shrink-0">
                <Contrast size={18} />
            </div>
            <p className="text-sm text-gray-700">
              <strong>Contraste é fundamental:</strong> A cor do chão deve ser diferente da cor da pele. <br/>
              <span className="text-xs text-gray-500">Ex: Pele escura em chão claro, ou vice-versa. Isso ajuda a detectar as pontas irregulares.</span>
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-1 text-orange-500 bg-orange-50 p-1 rounded shrink-0">
                <Sun size={18} />
            </div>
            <p className="text-sm text-gray-700">
              <strong>Evite Sombras Fortes:</strong> As sombras podem confundir a IA. Use luz uniforme e difusa sobre a pele.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-1 text-purple-600 bg-purple-50 p-1 rounded shrink-0">
                <Layers size={18} />
            </div>
            <p className="text-sm text-gray-700">
              <strong>Fundo Limpo:</strong> Evite pisos com padrões complexos (ladrilhos desenhados, madeira muito marcada). Um fundo liso funciona melhor.
            </p>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="mt-1 text-green-600 bg-green-50 p-1 rounded shrink-0">
                <CheckCircle size={18} />
            </div>
            <p className="text-sm text-gray-700">
              Coloque uma folha de <strong>papel A4 (branca)</strong> sobre a pele ou exatamente ao lado, sem dobras.
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-1 text-green-600 bg-green-50 p-1 rounded shrink-0">
                <CheckCircle size={18} />
            </div>
            <p className="text-sm text-gray-700">
              Tire a foto <strong>de cima para baixo (90°)</strong>. Fotos inclinadas distorcem o tamanho.
            </p>
          </div>
        </div>

        <div className="bg-leather-50 rounded-lg p-4 flex flex-col justify-center items-center text-center border border-leather-100 lg:col-span-1 md:col-span-2">
           <div className="relative w-full h-32 bg-gray-200 rounded mb-2 flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
             {/* Abstract irregular leather shape representation */}
             <svg viewBox="0 0 200 150" className="w-full h-full text-leather-800 opacity-80 drop-shadow-md">
                <path fill="currentColor" d="M40,40 Q60,10 90,30 T150,20 L170,50 Q190,80 160,110 T100,140 Q40,130 20,90 Z" />
             </svg>
             
             {/* A4 Paper representation */}
             <div className="absolute right-8 bottom-4 w-8 h-12 bg-white border border-gray-400 shadow-sm flex items-center justify-center rotate-6">
                <span className="text-[6px] font-bold text-gray-600">A4</span>
             </div>
           </div>
           <p className="text-xs text-leather-700 font-semibold mt-2">Correto: Fundo contrastante e A4 visível</p>
        </div>
      </div>
    </div>
  );
};