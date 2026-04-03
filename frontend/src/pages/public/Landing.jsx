import { useState } from 'react'
import { Link } from 'react-router-dom'

const Landing = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* NAVBAR */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <span className="text-2xl font-bold text-blue-700 shrink-0">
            DriverApp
          </span>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="border border-blue-700 text-blue-700 px-5 py-2 rounded-lg hover:bg-blue-50 transition-colors inline-flex items-center justify-center min-h-[44px]"
            >
              Login
            </Link>
            <Link
              to="/signup"
              className="bg-blue-700 text-white px-5 py-2 rounded-lg hover:bg-blue-800 transition-colors inline-flex items-center justify-center min-h-[44px]"
            >
              Register
            </Link>
          </div>

          <button
            type="button"
            className="flex md:hidden items-center justify-center min-h-[44px] min-w-[44px] rounded-lg text-blue-700 border border-blue-700 hover:bg-blue-50 transition-colors"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Menu band karein' : 'Menu kholein'}
          >
            <span className="text-2xl leading-none" aria-hidden>
              {mobileMenuOpen ? '×' : '☰'}
            </span>
          </button>
        </nav>

        {mobileMenuOpen && (
          <div className="md:hidden w-full border-t border-gray-100 bg-white shadow-md">
            <div className="flex flex-col w-full px-4 pb-4 pt-2 gap-2">
              <Link
                to="/login"
                className="w-full border border-blue-700 text-blue-700 px-5 py-3 rounded-lg hover:bg-blue-50 transition-colors text-center font-medium min-h-[44px] flex items-center justify-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="w-full bg-blue-700 text-white px-5 py-3 rounded-lg hover:bg-blue-800 transition-colors text-center font-medium min-h-[44px] flex items-center justify-center"
                onClick={() => setMobileMenuOpen(false)}
              >
                Register
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* HERO */}
      <section
        id="hero"
        className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center px-4 md:px-8 py-16 text-center"
      >
        <h1 className="text-3xl md:text-5xl font-bold text-gray-900 max-w-4xl leading-tight">
          Sahi Driver, Sahi Gadi
        </h1>
        <p className="text-base md:text-xl text-gray-600 mt-4 max-w-2xl">
          India ka pehla heavy vehicle workforce platform — JCB, Truck, Dumper,
          Crane operators ke liye
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center w-full max-w-xl px-0">
          <Link
            to="/signup"
            className="bg-blue-700 text-white px-8 py-4 rounded-xl text-lg hover:bg-blue-800 transition-colors shadow-md hover:shadow-lg inline-flex items-center justify-center min-h-[44px]"
          >
            Owner? Register karein
          </Link>
          <Link
            to="/signup"
            className="border-2 border-blue-700 text-blue-700 px-8 py-4 rounded-xl text-lg hover:bg-blue-50 transition-colors inline-flex items-center justify-center min-h-[44px]"
          >
            Driver? Kaam dhundho
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section id="stats" className="bg-white py-16 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="text-center p-4 md:p-6 rounded-xl hover:shadow-md transition-shadow">
            <p className="text-3xl md:text-4xl font-bold text-blue-700">500+</p>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Registered Owners
            </p>
          </div>
          <div className="text-center p-4 md:p-6 rounded-xl hover:shadow-md transition-shadow">
            <p className="text-3xl md:text-4xl font-bold text-blue-700">2000+</p>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Verified Drivers
            </p>
          </div>
          <div className="text-center p-4 md:p-6 rounded-xl hover:shadow-md transition-shadow">
            <p className="text-3xl md:text-4xl font-bold text-blue-700">1000+</p>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              Jobs Completed
            </p>
          </div>
          <div className="text-center p-4 md:p-6 rounded-xl hover:shadow-md transition-shadow">
            <p className="text-3xl md:text-4xl font-bold text-blue-700">28</p>
            <p className="text-gray-600 mt-2 text-sm md:text-base">
              States Covered
            </p>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section
        id="how-it-works"
        className="bg-gray-50 py-16 px-4 md:px-12"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-gray-900 px-2">
          Kaise Kaam Karta Hai?
        </h2>
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="text-center md:text-left">
            <span className="inline-block bg-blue-700 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              Gadi Owner
            </span>
            <ol className="space-y-4 text-gray-700 list-decimal list-inside text-left">
              <li>Register karein aur profile banayein</li>
              <li>
                Job post karein — vehicle type, location, salary batayein
              </li>
              <li>Applications dekhein, driver chunein, hire karein</li>
              <li>Attendance track karein, UTR se payment karein</li>
            </ol>
          </div>
          <div className="text-center md:text-left">
            <span className="inline-block bg-green-600 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
              Driver
            </span>
            <ol className="space-y-4 text-gray-700 list-decimal list-inside text-left">
              <li>Register karein, documents upload karein</li>
              <li>Apne state mein jobs dhundho</li>
              <li>Apply karein, joining letter sign karein</li>
              <li>Kaam karein, attendance bharein, payment paayein</li>
            </ol>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="bg-white py-16 px-4 md:px-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-gray-900 px-2">
          Platform Ki Khasiyat
        </h2>
        <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all">
            <div className="text-3xl mb-3">✓</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Verified Drivers
            </h3>
            <p className="text-gray-500 text-sm">
              Saare drivers document verified hain
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all">
            <div className="text-3xl mb-3">📄</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Joining Letter
            </h3>
            <p className="text-gray-500 text-sm">
              Legal joining letter har kaam ke liye
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all">
            <div className="text-3xl mb-3">📅</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Attendance Tracking
            </h3>
            <p className="text-gray-500 text-sm">
              Digital attendance aur salary calculation
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all">
            <div className="text-3xl mb-3">💳</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              UTR Payment Proof
            </h3>
            <p className="text-gray-500 text-sm">
              Payment ka UTR proof dono ke paas
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all">
            <div className="text-3xl mb-3">📢</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Complaint System
            </h3>
            <p className="text-gray-500 text-sm">
              Problem ho toh admin se seedha baat
            </p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-lg hover:border-blue-100 transition-all">
            <div className="text-3xl mb-3">⭐</div>
            <h3 className="text-lg font-semibold mb-2 text-gray-900">
              Rating System
            </h3>
            <p className="text-gray-500 text-sm">
              Driver aur owner dono ko rate karo
            </p>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section
        id="pricing"
        className="bg-gradient-to-br from-blue-50 to-indigo-100 py-16 px-4 md:px-8"
      >
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12 text-gray-900 px-2">
          Simple Pricing
        </h2>
        <div className="max-w-lg md:max-w-3xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sm:p-8 hover:shadow-xl transition-shadow w-full min-w-0">
            <span className="inline-block bg-blue-700 text-white text-sm font-semibold px-3 py-1 rounded-full mb-4">
              Gadi Owner
            </span>
            <div className="flex flex-wrap items-baseline gap-1 mt-2">
              <span className="text-4xl sm:text-5xl font-bold text-gray-900">
                ₹499
              </span>
              <span className="text-gray-500">/month</span>
            </div>
            <ul className="mt-6 space-y-2 text-gray-700 text-sm">
              <li>✓ Unlimited job posts</li>
              <li>✓ Driver profiles access</li>
              <li>✓ Joining letter generate</li>
              <li>✓ Attendance management</li>
              <li>✓ Complaint support</li>
            </ul>
            <Link
              to="/signup"
              className="mt-8 w-full flex items-center justify-center text-center bg-blue-700 text-white py-3 rounded-xl font-semibold hover:bg-blue-800 transition-colors min-h-[44px]"
            >
              Shuru Karein
            </Link>
          </div>
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 sm:p-8 hover:shadow-xl transition-shadow w-full min-w-0">
            <span className="inline-block bg-green-600 text-white text-sm font-semibold px-3 py-1 rounded-full mb-4">
              Driver
            </span>
            <div className="flex flex-wrap items-baseline gap-1 mt-2">
              <span className="text-4xl sm:text-5xl font-bold text-gray-900">
                ₹99
              </span>
              <span className="text-gray-500">/month</span>
            </div>
            <ul className="mt-6 space-y-2 text-gray-700 text-sm">
              <li>✓ Unlimited job applications</li>
              <li>✓ Profile showcase</li>
              <li>✓ Digital joining letter</li>
              <li>✓ Attendance tracking</li>
              <li>✓ Payment protection</li>
            </ul>
            <Link
              to="/signup"
              className="mt-8 w-full flex items-center justify-center text-center bg-green-600 text-white py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors min-h-[44px]"
            >
              Kaam Dhundho
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          <div className="text-center md:text-left">
            <p className="text-xl font-bold text-blue-400">DriverApp</p>
            <p className="text-gray-400 text-sm mt-2">
              Sahi Driver, Sahi Gadi — Sahi Jagah
            </p>
          </div>
          <div className="text-center md:text-left">
            <p className="font-semibold mb-3">Links</p>
            <ul className="space-y-1 text-gray-400 text-sm">
              <li>
                <a
                  href="#"
                  className="hover:text-white transition-colors flex items-center justify-center md:block md:text-left py-3 md:py-1 min-h-[44px] md:min-h-0"
                >
                  About
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-white transition-colors flex items-center justify-center md:block md:text-left py-3 md:py-1 min-h-[44px] md:min-h-0"
                >
                  Contact
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-white transition-colors flex items-center justify-center md:block md:text-left py-3 md:py-1 min-h-[44px] md:min-h-0"
                >
                  Terms
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="hover:text-white transition-colors flex items-center justify-center md:block md:text-left py-3 md:py-1 min-h-[44px] md:min-h-0"
                >
                  Privacy
                </a>
              </li>
            </ul>
          </div>
          <div className="text-center md:text-left">
            <p className="font-semibold mb-3">Hamare saath judo</p>
            <Link
              to="/signup"
              className="inline-flex items-center justify-center bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors min-h-[44px] font-medium"
            >
              Register
            </Link>
          </div>
        </div>
        <p className="text-center text-gray-500 text-sm mt-10 pt-8 border-t border-gray-800 px-2">
          © 2024 DriverApp. All rights reserved.
        </p>
      </footer>
    </div>
  )
}

export default Landing
