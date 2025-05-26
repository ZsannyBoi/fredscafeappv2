import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section with fixed header */}
      <section className="relative min-h-screen flex flex-col">
        <div className="absolute inset-0 z-0">
          <img 
            src="/src/assets/banner.jpg" 
            alt="Cafe" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/60"></div>
        </div>
        
        {/* Fixed Header */}
        <header className="relative z-10 py-6 px-6 md:px-10 flex justify-between items-center">
          <div className="flex items-center">
            <img src="/src/assets/logo.svg" alt="EspressoLane Logo" className="h-10 mr-4" />
            <h1 className="text-white text-2xl font-bold">EspressoLane</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="px-6 py-2 bg-white text-emerald-700 rounded-full font-medium transition-all hover:bg-opacity-90">
              Sign In
            </Link>
            <Link to="/register" className="px-6 py-2 bg-emerald-600 text-white rounded-full font-medium transition-all hover:bg-emerald-700">
              Sign Up
            </Link>
          </div>
        </header>
        
        {/* Hero Content - Centered vertically and horizontally */}
        <div className="flex-grow flex items-center relative z-10">
          <div className="container mx-auto px-6 md:px-10">
            <div className="max-w-3xl">
              <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
                Streamline Your Coffee Shop Experience
              </h1>
              <p className="text-xl text-gray-200 mb-10 max-w-2xl">
                EspressoLane helps cafe owners and staff manage orders, rewards, and operations in one seamless platform.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link to="/login" className="px-8 py-3 bg-emerald-600 text-white rounded-full font-medium text-lg transition-all hover:bg-emerald-700">
                  Get Started
                </Link>
                <a href="#features" className="px-8 py-3 bg-white/20 text-white rounded-full font-medium text-lg transition-all hover:bg-white/30 backdrop-blur-sm">
                  Learn More
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-14">Why Choose EspressoLane?</h2>
          
          <div className="grid md:grid-cols-3 gap-10">
            <div className="bg-stone-50 rounded-xl p-8 shadow-sm border border-stone-100 flex flex-col items-center text-center transform transition-transform hover:scale-105 hover:shadow-md">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6">
                <img src="/src/assets/menu.svg" alt="Menu" className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">Menu Management</h3>
              <p className="text-gray-600">
                Easily update your menu items, adjust prices, and organize categories to keep your offerings fresh and appealing.
              </p>
            </div>
            
            <div className="bg-stone-50 rounded-xl p-8 shadow-sm border border-stone-100 flex flex-col items-center text-center transform transition-transform hover:scale-105 hover:shadow-md">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                <img src="/src/assets/order.svg" alt="Order" className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">Order Processing</h3>
              <p className="text-gray-600">
                Streamline your order workflow from receipt to delivery, reducing wait times and improving customer satisfaction.
              </p>
            </div>
            
            <div className="bg-stone-50 rounded-xl p-8 shadow-sm border border-stone-100 flex flex-col items-center text-center transform transition-transform hover:scale-105 hover:shadow-md">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-6">
                <img src="/src/assets/rewards.svg" alt="Rewards" className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-800">Loyalty Rewards</h3>
              <p className="text-gray-600">
                Build customer loyalty with a customizable rewards program that keeps customers coming back for more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 bg-emerald-50">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-14">What Our Users Say</h2>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full mr-4 overflow-hidden">
                  <img src="https://randomuser.me/api/portraits/men/42.jpg" alt="Frederick Bald" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="font-semibold">Frederick Bald</h4>
                  <p className="text-sm text-gray-500">Cafe Owner</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "EspressoLane has transformed how we manage our cafe. The order tracking system alone has reduced our wait times by 30%!"
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-xl shadow-sm border border-stone-100 hover:shadow-md transition-shadow">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-full mr-4 overflow-hidden">
                  <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Eddie Garbel" className="w-full h-full object-cover" />
                </div>
                <div>
                  <h4 className="font-semibold">Eddie Garbel</h4>
                  <p className="text-sm text-gray-500">Business Software Specialist</p>
                </div>
              </div>
              <p className="text-gray-600 italic">
                "From a technical perspective, EspressoLane offers the most intuitive interface I've seen for cafe management. The integration capabilities and analytics dashboard provide incredible business insights."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-emerald-700 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to streamline your cafe operations?</h2>
          <p className="text-xl mb-10 max-w-2xl mx-auto">
            Join thousands of cafe owners and staff who've improved their business with EspressoLane.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/register" className="px-8 py-3 bg-white text-emerald-700 rounded-full font-medium text-lg transition-all hover:bg-gray-100">
              Get Started Free
            </Link>
            <Link to="/login" className="px-8 py-3 bg-emerald-600 text-white rounded-full font-medium text-lg transition-all hover:bg-emerald-800 border border-white/30">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Simplified Footer */}
      <footer className="py-10 bg-gray-800 text-gray-300">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-6 md:mb-0">
              <img src="/src/assets/logo.svg" alt="EspressoLane Logo" className="h-8 mr-3" />
              <h3 className="text-xl font-bold text-white">EspressoLane</h3>
            </div>
            
            <div className="flex space-x-6 mt-4 md:mt-0">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <span className="sr-only">Instagram</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-6 text-center">
            <p className="text-sm text-gray-400">© 2025 EspressoLane. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage; 