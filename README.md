# Heat Dashboard Harnessed

## Sistema de evidencias

### Ejecutar tests en local
cd e2e  
npm run test:e2e
### Generar evidencias completas (screenshots + reports)
npm run capture:evidence  
Los screenshots se generan en evidence/screenshots/ pero no se versionan en git. En CI se suben automáticamente como artifacts de GitHub Actions con retención de 30 días.