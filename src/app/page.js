"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Mail, Phone } from "lucide-react";

// Set your launch date here (YYYY-MM-DD format)
const LAUNCH_DATE = new Date("2027-12-01T00:00:00");

function getTimeLeft() {
  const now = new Date();
  const diff = LAUNCH_DATE - now;
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
}

function TimerUnit({ value, label }) {
  return (
    <div className="timer-unit">
      <div className="timer-value">
        {String(value).padStart(2, "0")}
      </div>
      <div className="timer-label">{label}</div>
    </div>
  );
}

export default function ComingSoonPage() {
  const [time, setTime] = useState(getTimeLeft());

  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeLeft()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="coming-soon-root">
      {/* Background image — replace /coming-soon-bg.jpg in /public */}
      <div className="coming-soon-bg" />
      <div className="coming-soon-overlay" />

      <div className="coming-soon-content">
        {/* Logo */}
        <div className="coming-soon-logo-wrap">
          <Image
            src="/magtus_logo.png"
            alt="Magtus Logo"
            width={180}
            height={60}
            priority
            className="coming-soon-logo"
          />
        </div>

        {/* Heading */}
        <h1 className="coming-soon-heading">Coming Soon</h1>
        <p className="coming-soon-subtext">
          We&apos;re building something amazing. Stay tuned!
        </p>

        {/* Countdown Timer */}
        <div className="coming-soon-timer">
          <TimerUnit value={time.days} label="Days" />
          <span className="timer-colon">:</span>
          <TimerUnit value={time.hours} label="Hours" />
          <span className="timer-colon">:</span>
          <TimerUnit value={time.minutes} label="Minutes" />
          <span className="timer-colon">:</span>
          <TimerUnit value={time.seconds} label="Seconds" />
        </div>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Footer */}
        <footer className="coming-soon-footer">
          <div className="coming-soon-contact">
            <a href="mailto:info@magtus.com" className="contact-link">
              <Mail size={18} />
              <span>info@magtus.com</span>
            </a>
            <a href="tel:+919876543210" className="contact-link">
              <Phone size={18} />
              <span>+91 98765 43210</span>
            </a>
          </div>
          <div className="coming-soon-socials">
            <a href="https://instagram.com/magtus" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
            </a>
            <a href="https://facebook.com/magtus" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
            </a>
            <a href="https://twitter.com/magtus" target="_blank" rel="noopener noreferrer" aria-label="Twitter">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </a>
            <a href="https://youtube.com/@magtus" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></svg>
            </a>
            <a href="https://linkedin.com/company/magtus" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>
            </a>
          </div>
          <p className="coming-soon-copyright">
            &copy; {new Date().getFullYear()} Magtus. All rights reserved.
          </p>
        </footer>
      </div>
    </div>
  );
}
