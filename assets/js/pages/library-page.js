import { initSharedApp } from '../app.js';
import { mountLibraryPage } from '../features/library.js';

const root = document.getElementById('pageRoot');
initSharedApp('library');
mountLibraryPage(root);
