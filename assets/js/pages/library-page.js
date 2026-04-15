import { initSharedApp } from '../app.js';
import { renderLibraryPage } from '../features/library.js';

const root = document.getElementById('pageRoot');
initSharedApp('library');
renderLibraryPage(root);
window.addEventListener('velvet:library-changed', () => renderLibraryPage(root));
