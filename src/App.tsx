/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameCanvas } from './components/GameCanvas';

export default function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      <GameCanvas />
    </div>
  );
}
