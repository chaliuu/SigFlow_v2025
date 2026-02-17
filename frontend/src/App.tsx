import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MathJaxContext } from 'better-react-mathjax';
import LandingPage from './pages/LandingPage';
import EditorPage from './pages/EditorPage';

const mathJaxConfig = {
  loader: { load: ['[tex]/ams'] },
  tex: {
    packages: { '[+]': ['ams'] },
    inlineMath: [['\\(', '\\)']],
    displayMath: [['\\[', '\\]']],
  },
};

export default function App() {
  return (
    <MathJaxContext config={mathJaxConfig}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/editor/:circuitId" element={<EditorPage />} />
        </Routes>
      </BrowserRouter>
    </MathJaxContext>
  );
}
