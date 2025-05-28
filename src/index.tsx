import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

// 기본 컴포넌트는 후에 구현할 예정
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="p-4 bg-blue-100 rounded">
      <h1 className="text-xl font-bold">Play LearnEng</h1>
      <p>Learning English with CoupangPlay</p>
    </div>
  </React.StrictMode>,
);
