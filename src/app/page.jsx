'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Code, Database, LineChart, ChevronRight, Github, Linkedin, Mail } from 'lucide-react';
import { Button } from "@/components/ui/button";

export default function Page() {
  const [isScrolled, setIsScrolled] = useState(false);
  
  // Handle scroll for navbar transparency
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white">
      {/* Navbar */}
      <header className={`fixed w-full z-50 transition-all duration-300 ${isScrolled ? 'bg-slate-950/90 backdrop-blur-sm' : 'bg-transparent'}`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-xl font-bold tracking-wider">
              MIKAEEL FARAZ
            </Link>
            
            <nav className="hidden md:flex space-x-8">
              <Link href="#about" className="text-slate-300 hover:text-blue-400 transition-colors">ABOUT</Link>
              <Link href="#projects" className="text-slate-300 hover:text-blue-400 transition-colors">PROJECTS</Link>
              <Link href="#experience" className="text-slate-300 hover:text-blue-400 transition-colors">EXPERIENCE</Link>
              <Link href="#achievements" className="text-slate-300 hover:text-blue-400 transition-colors">ACHIEVEMENTS</Link>
              <Link href="#contact" className="text-slate-300 hover:text-blue-400 transition-colors">CONTACT</Link>
            </nav>
            
            <button className="md:hidden">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section with Code Background */}
      <section className="relative min-h-screen flex items-center">
        {/* Decorative code snippets */}
        <div className="absolute right-0 top-0 h-full w-1/2 opacity-10 select-none pointer-events-none overflow-hidden">
          <div className="absolute text-blue-400 font-mono opacity-30 text-sm md:text-base top-1/4 right-1/3">
            console.log("Hello World");
          </div>
          <div className="absolute text-green-400 font-mono opacity-30 text-sm md:text-base bottom-1/3 right-1/4">
            import pandas as pd
          </div>
          <div className="absolute text-purple-400 font-mono opacity-30 text-sm md:text-base top-1/2 right-1/4">
            def train_model(X, y):
          </div>
          <div className="absolute text-indigo-400 font-mono opacity-30 text-sm md:text-base bottom-1/4 right-1/3">
            &lt;html&gt;
          </div>
          <div className="absolute text-pink-400 font-mono opacity-30 text-sm md:text-base bottom-2/5 right-1/5">
            $ npm install
          </div>
          <div className="absolute text-yellow-400 font-mono opacity-30 text-sm md:text-base top-3/5 right-1/6">
            class="container"
          </div>
          <div className="absolute text-cyan-400 font-mono opacity-30 text-sm md:text-base bottom-1/5 right-1/3">
            Grid
          </div>
          <div className="absolute text-red-400 font-mono opacity-30 text-sm md:text-base top-1/5 right-1/5">
            npm install
          </div>
        </div>
        
        <div className="container mx-auto px-4 z-10">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <motion.h1 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-6xl md:text-8xl font-bold mb-6 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 text-transparent bg-clip-text"
              >
                DATA<br />SCIENTIST
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-xl md:text-2xl mb-8 text-slate-300"
              >
                I am Mikaeel – <span className="text-blue-400">data scientist</span> with a passion for 
                creating intelligent solutions using machine learning and AI.
              </motion.p>
              
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                <Link href="#projects">
                  <Button className="rounded-full px-8 py-6 text-lg bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all">
                    VIEW MY WORK
                  </Button>
                </Link>
              </motion.div>
            </div>
            
            <div className="md:w-1/2 md:flex md:justify-center">
              <div className="relative w-64 h-64 md:w-80 md:h-80 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                <div className="absolute -top-2 -right-2 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center text-white">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M19 5L5 19M5 5L19 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </motion.div>
                </div>
                <Image
                  src="/headshot.png"
                  alt="Mikaeel Faraz"
                  width={200}
                  height={200}
                  className="rounded-full"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-20">
        <div className="container mx-auto px-4">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-16 bg-gradient-to-r from-pink-500 to-blue-500 text-transparent bg-clip-text"
          >
            MY SERVICES
          </motion.h2>
          
          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
            <div className="relative bg-slate-900/50 rounded-xl p-8 border border-slate-800 hover:border-blue-500/30 transition-all group">
              <div className="text-blue-500 mb-4">
                <Database size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Data Analysis</h3>
              <p className="text-slate-400">
                I transform raw data into actionable insights using statistical methods and visualization techniques, helping businesses make informed decisions based on their data.
              </p>
            </div>
            
            <div className="relative bg-slate-900/50 rounded-xl p-8 border border-slate-800 hover:border-blue-500/30 transition-all group">
              <div className="text-blue-500 mb-4">
                <Code size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Machine Learning</h3>
              <p className="text-slate-400">
                I develop custom machine learning models that can predict trends, classify data, and provide valuable insights from your datasets, enhancing decision-making processes.
              </p>
            </div>
            
            <div className="relative bg-slate-900/50 rounded-xl p-8 border border-slate-800 hover:border-blue-500/30 transition-all group">
              <div className="text-blue-500 mb-4">
                <LineChart size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-4">Time Series Forecasting</h3>
              <p className="text-slate-400">
                I specialize in analyzing time-based data to predict future values, helping businesses anticipate demand, optimize resources, and plan effectively.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Skills Section */}
      <section id="skills" className="py-20 bg-slate-950">
        <div className="container mx-auto px-4">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-16 bg-gradient-to-r from-pink-500 to-purple-500 text-transparent bg-clip-text"
          >
            SKILLS
          </motion.h2>
          
          <div className="mb-10">
            <h3 className="text-2xl text-center mb-12 text-slate-300">
              The skills, tools and technologies I use:
            </h3>
            
            <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-8 justify-items-center">
              {/* Skill Icons Row 1 */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/python.svg" alt="Python" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/pandas.svg" alt="Pandas" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/sklearn.svg" alt="Scikit-Learn" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/tensorflow.svg" alt="TensorFlow" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/jupyter.svg" alt="Jupyter" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/azure.svg" alt="Azure" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.7 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/java.svg" alt="Java" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.8 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/cpp.svg" alt="C++" className="h-12" />
              </motion.div>
              
              {/* Skill Icons Row 2 */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.9 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/javascript.svg" alt="JavaScript" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.0 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/react.svg" alt="React" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.1 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/node.svg" alt="Node.js" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.2 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/git.svg" alt="Git" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.3 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/powerbi.svg" alt="Power BI" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.4 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/pyspark.svg" alt="PySpark" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.5 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/html5.svg" alt="HTML5" className="h-12" />
              </motion.div>
              
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 1.6 }}
                className="w-16 h-16 flex items-center justify-center"
              >
                <img src="/icons/css3.svg" alt="CSS3" className="h-12" />
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Project Preview */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <motion.h2 
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-4xl md:text-6xl font-bold mb-16 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text"
          >
            FEATURED PROJECT
          </motion.h2>
          
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl overflow-hidden shadow-xl">
            <div className="relative">
              <div className="aspect-video bg-gradient-to-r from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                <div className="text-6xl text-slate-800">Project Preview</div>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
              <div className="absolute bottom-0 left-0 p-8">
                <h3 className="text-2xl md:text-3xl font-bold mb-2">Dunkin' Donuts Time Series Demand Forecast</h3>
                <p className="text-slate-300 mb-4">Python, Pandas, Scikit-Learn, Prophet</p>
                <Link href="#projects">
                  <Button className="rounded-full bg-blue-600 hover:bg-blue-700">
                    View Details <ChevronRight size={16} className="ml-1" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <Link href="#projects">
              <Button variant="outline" className="rounded-full border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white">
                View All Projects <ChevronRight size={16} className="ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Contact Preview */}
      <section id="contact-preview" className="py-20 bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <motion.h2 
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-pink-500 to-blue-500 text-transparent bg-clip-text"
              >
                DO YOU HAVE A PROJECT<br />TO DISCUSS?
              </motion.h2>
              
              <p className="text-2xl font-light text-slate-300 mb-8">GET IN TOUCH</p>
              
              <div className="mb-8">
                <h3 className="text-xl font-semibold mb-4">CONTACT</h3>
                <a href="mailto:mikaeel.faraz@example.com" className="text-blue-400 hover:text-blue-300 transition-colors">
                  mikaeel.faraz@example.com
                </a>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-4">SOCIAL MEDIA</h3>
                <div className="flex space-x-4">
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    <Linkedin size={24} />
                  </a>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    <Github size={24} />
                  </a>
                  <a href="#" className="text-slate-400 hover:text-white transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-instagram"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg>
                  </a>
                </div>
              </div>
            </div>
            
            <div className="bg-slate-900/50 rounded-xl p-8 border border-slate-800">
              <h3 className="text-xl font-semibold mb-6">CONTACT FORM</h3>
              
              <form>
                <div className="mb-4">
                  <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    className="w-full p-3 rounded-md border border-slate-700 bg-slate-800/50 text-white"
                    placeholder="Your Name"
                  />
                </div>
                
                <div className="mb-4">
                  <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">Email</label>
                  <input 
                    type="email" 
                    id="email" 
                    className="w-full p-3 rounded-md border border-slate-700 bg-slate-800/50 text-white"
                    placeholder="Your Email"
                  />
                </div>
                
                <div className="mb-6">
                  <label htmlFor="message" className="block text-sm font-medium text-slate-300 mb-1">Message</label>
                  <textarea 
                    id="message" 
                    rows={4} 
                    className="w-full p-3 rounded-md border border-slate-700 bg-slate-800/50 text-white"
                    placeholder="Your Message"
                  ></textarea>
                </div>
                
                <Button className="w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transition-all">
                  SEND
                </Button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 bg-slate-950 border-t border-slate-900">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <p className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} Mikaeel Faraz. All rights reserved.
            </p>
            
            <div className="flex space-x-4 mt-4 md:mt-0">
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Github size={20} />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Linkedin size={20} />
              </a>
              <a href="#" className="text-slate-500 hover:text-white transition-colors">
                <Mail size={20} />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}