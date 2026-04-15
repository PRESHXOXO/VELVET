import { initSharedApp } from '../app.js';
import { renderStationsPage } from '../features/stations.js';

initSharedApp('stations');
renderStationsPage(document.getElementById('pageRoot'));
