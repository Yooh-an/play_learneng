import React from 'react';
import ReactDOM from 'react-dom/client';
import '../index.css';

console.log('Play LearnEng Content Script Loaded');

// DOM에 UI 요소 추가를 위한 준비
const mountPoint = document.createElement('div');
mountPoint.id = 'play-learneng-container';
document.body.appendChild(mountPoint);

// React UI 렌더링
ReactDOM.createRoot(mountPoint).render(
  <React.StrictMode>
    <div className="fixed bottom-4 right-4 z-50 p-2 bg-white rounded shadow">
      <p className="text-sm font-bold">Play LearnEng</p>
    </div>
  </React.StrictMode>
);
