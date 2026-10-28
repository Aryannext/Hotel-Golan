import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';

// HG-HAL-001 HAL-43: avisos que hoy tienen estas reglas en componentes que la diseñadora frontend está rehaciendo
// (27-10-2026). Se apagan solo aquí para no chocar con su trabajo; al terminar el diseño se quita esta lista y se
// arreglan. Todo archivo nuevo o que no esté en la lista ya las cumple como error.
const PENDIENTES_DEL_DISENO = {
  'react-hooks/exhaustive-deps': [
    'src/web/App.tsx', 'src/web/componentes/CambioHabitacion.tsx', 'src/web/componentes/Entrada.tsx',
    'src/web/componentes/EntregarLavanderia.tsx', 'src/web/componentes/Ficha.tsx', 'src/web/componentes/LavanderiaExterna.tsx',
    'src/web/componentes/ProductosVendidos.tsx', 'src/web/componentes/RecibirTurno.tsx', 'src/web/componentes/ReportarMigracion.tsx',
    'src/web/componentes/SolicitudesFactura.tsx', 'src/web/componentes/VentaContado.tsx',
  ],
  'react-hooks/immutability': ['src/web/componentes/Panel.tsx', 'src/web/enVivo.ts'],
  'react-hooks/purity': ['src/web/componentes/PasoServicio.tsx'],
};

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.scratch/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Pantalla (Preact): reglas de los ganchos y de accesibilidad (WCAG) como error.
  {
    files: ['src/web/**/*.ts', 'src/web/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs['recommended-latest'].rules,
  },
  { files: ['src/web/**/*.tsx'], ...jsxA11y.configs.recommended },
  ...Object.entries(PENDIENTES_DEL_DISENO).map(([regla, files]) => ({ files, rules: { [regla]: 'off' } })),
);
