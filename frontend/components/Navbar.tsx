'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

// Spatters color palette
const COLORS = {
  background: '#EBE5D9',
  red: '#fc1a4a',
  green: '#75d494',
  blue: '#2587c3',
  yellow: '#f2c945',
  black: '#000000',
  white: '#FFFFFF',
};

export default function Navbar() {
  const { isConnected } = useAccount();
  const pathname = usePathname();

  // Determine which page is active
  const isHome = pathname === '/';
  const isCollection = pathname === '/collection';
  const isMySpatters = pathname === '/my-spatters';

  const linkStyle = (isActive: boolean) => ({
    color: isActive ? COLORS.red : COLORS.black,
    borderBottom: isActive ? `3px solid ${COLORS.red}` : '3px solid transparent',
    paddingBottom: '4px',
  });

  return (
    <header 
      className="border-b-2 sticky top-0 z-50" 
      style={{ borderColor: COLORS.black, backgroundColor: COLORS.background }}
    >
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          {/* Left: Navigation Links */}
          <div className="flex items-center gap-6">
            <Link 
              href="/" 
              className="font-bold text-lg hover:opacity-70 transition-opacity"
              style={linkStyle(isHome)}
            >
              Home
            </Link>
            <Link 
              href="/collection" 
              className="font-bold text-lg hover:opacity-70 transition-opacity"
              style={linkStyle(isCollection)}
            >
              Collection
            </Link>
            {isConnected && (
              <Link 
                href="/my-spatters" 
                className="font-bold text-lg hover:opacity-70 transition-opacity"
                style={linkStyle(isMySpatters)}
              >
                My Spatters
              </Link>
            )}
          </div>
          
          {/* Right: Wallet Connect */}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

