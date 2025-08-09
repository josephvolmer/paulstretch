'use client'

import Image from 'next/image'
import { ThemeToggle } from '@/components/theme-toggle'
import paulStretchImage from '@/public/paul-stretch.png'

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-4 md:px-8">
        {/* Logo and Title */}
        <div className="flex items-center gap-3">
          <Image 
            src={paulStretchImage} 
            alt="PaulStretch Mascot" 
            width={40} 
            height={40}
            className="animate-[bounce-gentle_3s_ease-in-out_infinite]"
          />
          <h1 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-400 bg-clip-text text-transparent">
            PaulStretch
          </h1>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  )
}