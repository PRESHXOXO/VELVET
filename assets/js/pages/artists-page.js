import { initSharedApp } from '../app.js';
import { renderArtistsPage } from '../features/artists.js';

initSharedApp('artists');
renderArtistsPage(document.getElementById('pageRoot'));
