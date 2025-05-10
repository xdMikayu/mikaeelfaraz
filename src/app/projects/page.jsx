'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft,
  ArrowRight,
  ChevronRight, 
  Github, 
  ExternalLink,
  Calendar,
  Clock,
  Tag,
  Code,
  Database,
  LineChart,
  BarChart,
  Layers,
  Cpu,
  Monitor,
  Filter,
  Search
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";



export default function ProjectsPage() {
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedProject, setSelectedProject] = useState(null);
    const [filteredProjects, setFilteredProjects] = useState(projects);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortOption, setSortOption] = useState('newest');
    
    const projectRefs = useRef({});
    
    // Filter projects based on category and search query
    useEffect(() => {
      let filtered = [...projects];
      
      // Filter by category
      if (selectedCategory !== 'all') {
        filtered = filtered.filter(project => project.category.toLowerCase() === selectedCategory.toLowerCase());
      }
      
      // Filter by search query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(project => 
          project.title.toLowerCase().includes(query) || 
          project.description.toLowerCase().includes(query) ||
          project.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }
      
      // Sort projects
      if (sortOption === 'newest') {
        // Assuming the duration field has the date in format "Month Year - Month Year"
        filtered.sort((a, b) => {
          const aEndDate = a.duration.split(' - ')[1] || a.duration;
          const bEndDate = b.duration.split(' - ')[1] || b.duration;
          return new Date(bEndDate) - new Date(aEndDate);
        });
      } else if (sortOption === 'oldest') {
        filtered.sort((a, b) => {
          const aStartDate = a.duration.split(' - ')[0];
          const bStartDate = b.duration.split(' - ')[0];
          return new Date(aStartDate) - new Date(bStartDate);
        });
      } else if (sortOption === 'alphabetical') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
      }
      
      setFilteredProjects(filtered);
    }, [selectedCategory, searchQuery, sortOption]);
    
    // Handle project selection
    const handleProjectSelect = (project) => {
      setSelectedProject(project);
      setIsModalOpen(true);
      document.body.style.overflow = 'hidden';
    };
    
    // Handle modal close
    const handleCloseModal = () => {
      setIsModalOpen(false);
      document.body.style.overflow = 'visible';
    };
    
    // Handle category change
    const handleCategoryChange = (category) => {
      setSelectedCategory(category);
    };
    
    // Handle search query change
    const handleSearchChange = (e) => {
      setSearchQuery(e.target.value);
    };
    
    // Handle sort option change
    const handleSortChange = (value) => {
      setSortOption(value);
    };
    
    // Scroll to project section
    const scrollToProject = (id) => {
      if (projectRefs.current[id]) {
        projectRefs.current[id].scrollIntoView({ behavior: 'smooth' });
      }
    };
  
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 text-white">
        {/* Page header */}
        <div className="bg-slate-950 pt-28 pb-16 border-b border-slate-800">
          <div className="container mx-auto px-4">
            <div className="flex flex-col items-center text-center">
              <Link href="/" className="flex items-center mb-6 text-slate-400 hover:text-blue-400 transition-colors">
                <ArrowLeft size={16} className="mr-2" /> Back to Home
              </Link>
              
              <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text">
                My Projects
              </h1>
              
              <p className="text-lg text-slate-300 max-w-3xl mb-8">
                A collection of my work in data science, machine learning, and software development.
                Each project demonstrates my approach to problem-solving and technical implementation.
              </p>
              
              <div className="flex flex-wrap justify-center gap-4">
                <Badge 
                  variant={selectedCategory === 'all' ? 'default' : 'outline'} 
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleCategoryChange('all')}
                >
                  All Projects
                </Badge>
                
                <Badge 
                  variant={selectedCategory === 'data science' ? 'default' : 'outline'} 
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleCategoryChange('data science')}
                >
                  Data Science
                </Badge>
                
                <Badge 
                  variant={selectedCategory === 'machine learning' ? 'default' : 'outline'} 
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleCategoryChange('machine learning')}
                >
                  Machine Learning
                </Badge>
                
                <Badge 
                  variant={selectedCategory === 'data engineering' ? 'default' : 'outline'} 
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleCategoryChange('data engineering')}
                >
                  Data Engineering
                </Badge>
                
                <Badge 
                  variant={selectedCategory === 'artificial intelligence' ? 'default' : 'outline'} 
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleCategoryChange('artificial intelligence')}
                >
                  Artificial Intelligence
                </Badge>
                
                <Badge 
                  variant={selectedCategory === 'software development' ? 'default' : 'outline'} 
                  className="px-4 py-2 cursor-pointer"
                  onClick={() => handleCategoryChange('software development')}
                >
                  Software Development
                </Badge>
              </div>
            </div>
          </div>
        </div>
        
        {/* Filter and search bar */}
        <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-sm py-4 border-b border-slate-800">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="relative w-full md:w-auto">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                <Input 
                  type="text" 
                  placeholder="Search projects..." 
                  value={searchQuery}
                  onChange={handleSearchChange}
                  className="pl-10 bg-slate-900 border-slate-700 w-full md:w-80 focus:border-blue-500"
                />
              </div>
              
              <div className="flex items-center gap-3">
                <Filter size={16} className="text-slate-400" />
                <span className="text-slate-400 text-sm">Sort by:</span>
                <Select value={sortOption} onValueChange={handleSortChange}>
                  <SelectTrigger className="w-40 bg-slate-900 border-slate-700">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-slate-700">
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Featured projects section */}
        {selectedCategory === 'all' && searchQuery === '' && (
          <section className="py-16">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold mb-10 flex items-center">
                <span className="bg-blue-500/20 text-blue-400 p-1 rounded-md mr-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-star">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                </span>
                Featured Projects
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {projects.filter(project => project.featured).map((project) => (
                  <motion.div 
                    key={project.id}
                    ref={el => projectRefs.current[project.id] = el}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className={`bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl overflow-hidden shadow-xl border border-slate-800 hover:border-${project.color}-500/50 transition-all group`}
                  >
                    <div className="relative">
                    <div className="aspect-video overflow-hidden rounded-t-xl">
                        <img 
                            src={project.image} 
                            alt={project.title}
                            className="w-full h-full object-contain bg-slate-900"
                        />
                        </div>
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
                      <div className="absolute bottom-0 left-0 p-6">
                        <span className={`px-2 py-1 text-xs rounded-full bg-${project.color}-500/20 text-${project.color}-300 mb-2 inline-block`}>
                          {project.category}
                        </span>
                        <h3 className="text-xl font-bold mb-1">{project.title}</h3>
                        <p className="text-slate-400 text-sm">{project.shortDescription}</p>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      <div className="flex items-center text-sm text-slate-400">
                        <Calendar size={14} className="mr-2" />
                        {project.duration}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {project.tags.slice(0, 3).map((tag, index) => (
                          <Badge key={index} variant="outline" className="bg-slate-800/50">
                            {tag}
                          </Badge>
                        ))}
                        {project.tags.length > 3 && (
                          <Badge variant="outline" className="bg-slate-800/50">
                            +{project.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                      <Button 
                        onClick={() => handleProjectSelect(project)}
                        className={`w-full rounded-lg bg-${project.color}-600 hover:bg-${project.color}-700 group-hover:bg-${project.color}-500 transition-colors`}
                      >
                        View Details <ChevronRight size={16} className="ml-1" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </section>
        )}
        
        {/* All projects section */}
        <section className="py-16">
          <div className="container mx-auto px-4">
            {/* Show heading only when not in default view */}
            {(selectedCategory !== 'all' || searchQuery !== '') && (
              <h2 className="text-3xl font-bold mb-10">
                {searchQuery ? 'Search Results' : `${selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Projects`}
              </h2>
            )}
            
            {/* Show message when no projects match the filters */}
            {filteredProjects.length === 0 && (
              <div className="text-center py-20">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-800 mb-4">
                  <Search size={24} className="text-slate-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">No projects found</h3>
                <p className="text-slate-400 mb-6">
                  Try adjusting your search or filter criteria to find what you're looking for.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                  }}
                >
                  Reset Filters
                </Button>
              </div>
            )}
            
            {/* Projects grid */}
            {selectedCategory === 'all' && searchQuery === '' ? (
              // For the default view, exclude featured projects as they're shown above
              filteredProjects.filter(project => !project.featured).length > 0 && (
                <>
                  <h2 className="text-3xl font-bold mb-10">All Projects</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredProjects.filter(project => !project.featured).map((project) => (
                      <ProjectCard 
                        key={project.id} 
                        project={project} 
                        onClick={() => handleProjectSelect(project)}
                        ref={el => projectRefs.current[project.id] = el}
                      />
                    ))}
                  </div>
                </>
              )
            ) : (
              // For filtered views, show all matching projects
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredProjects.map((project) => (
                  <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onClick={() => handleProjectSelect(project)}
                    ref={el => projectRefs.current[project.id] = el}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
        
        {/* Project detail modal */}
        <AnimatePresence>
          {isModalOpen && selectedProject && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
              onClick={handleCloseModal}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: 'spring', damping: 25 }}
                className="bg-slate-900 rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
              >
                <ProjectDetail project={selectedProject} onClose={handleCloseModal} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  
  // Project card component
  const ProjectCard = ({ project, onClick }) => {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className={`bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl overflow-hidden shadow-xl border border-slate-800 hover:border-${project.color}-500/30 transition-all group`}
      >
        <div className="relative">
          <div className="aspect-video overflow-hidden rounded-t-xl">
            <img 
              src={project.image} 
              alt={project.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
          <div className="absolute bottom-0 left-0 p-6">
            <span className={`px-2 py-1 text-xs rounded-full bg-${project.color}-500/20 text-${project.color}-300 mb-2 inline-block`}>
              {project.category}
            </span>
            <h3 className="text-xl font-bold mb-1">{project.title}</h3>
            <p className="text-slate-400 text-sm">{project.shortDescription}</p>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center text-sm text-slate-400">
            <Calendar size={14} className="mr-2" />
            {project.duration}
          </div>
          <div className="flex flex-wrap gap-2">
            {project.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="bg-slate-800/50">
                {tag}
              </Badge>
            ))}
            {project.tags.length > 3 && (
              <Badge variant="outline" className="bg-slate-800/50">
                +{project.tags.length - 3}
              </Badge>
            )}
          </div>
          <Button 
            onClick={onClick}
            className={`w-full rounded-lg bg-${project.color}-600 hover:bg-${project.color}-700 group-hover:bg-${project.color}-500 transition-colors`}
          >
            View Details <ChevronRight size={16} className="ml-1" />
          </Button>
        </div>
      </motion.div>
    );
  };
  
  // Project detail component
  const ProjectDetail = ({ project, onClose }) => {
    return (
      <div className="p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <span className={`px-2 py-1 text-xs rounded-full bg-${project.color}-500/20 text-${project.color}-300 mb-2 inline-block`}>
              {project.category}
            </span>
            <h2 className="text-2xl md:text-3xl font-bold">{project.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-x">
              <path d="M18 6 6 18"/>
              <path d="m6 6 12 12"/>
            </svg>
          </button>
        </div>
        
        <div className="space-y-6">
          {/* Project image or icon */}
          <div className="rounded-xl overflow-hidden bg-slate-800 h-64 mb-6">
            <img 
                src={project.image} 
                alt={project.title}
                className="w-full h-full object-contain bg-slate-900"
            />
            </div>
          
          {/* Project details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Timeline</h3>
              <div className="flex items-center">
                <Calendar size={16} className="mr-2 text-slate-400" />
                <span>{project.duration}</span>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Category</h3>
              <div className="flex items-center">
                <Tag size={16} className="mr-2 text-slate-400" />
                <span>{project.category}</span>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-slate-400 mb-2">Links</h3>
              <div className="flex space-x-3">
                {project.links.github && (
                  <a 
                    href={project.links.github} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <Github size={16} className="mr-1" />
                    <span>GitHub</span>
                  </a>
                )}
                
                {project.links.live && (
                  <a 
                    href={project.links.live} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center text-green-400 hover:text-green-300 transition-colors"
                  >
                    <ExternalLink size={16} className="mr-1" />
                    <span>Live Demo</span>
                  </a>
                )}
              </div>
            </div>
          </div>
          
          {/* Project description */}
          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4">Overview</h3>
            <p className="text-slate-300 leading-relaxed mb-4">{project.description}</p>
            
            <div className="flex flex-wrap gap-2 mt-4">
              {project.tags.map((tag, index) => (
                <Badge key={index} variant="outline" className="bg-slate-800/50">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          
          {/* Project tabs */}
          <Tabs defaultValue="objectives" className="mt-8">
            <TabsList className="bg-slate-800 border-b border-slate-700">
              <TabsTrigger value="objectives">Objectives</TabsTrigger>
              <TabsTrigger value="approach">Approach</TabsTrigger>
              <TabsTrigger value="outcomes">Outcomes</TabsTrigger>
              <TabsTrigger value="technologies">Tech Stack</TabsTrigger>
            </TabsList>
            
            <TabsContent value="objectives" className="pt-6">
              <h3 className="text-xl font-bold mb-4">Project Objectives</h3>
              <ul className="space-y-2">
                {project.objectives.map((objective, index) => (
                  <li key={index} className="flex items-start">
                    <div className={`min-w-5 h-5 mt-1 rounded-full bg-${project.color}-900/50 text-${project.color}-400 flex items-center justify-center mr-3`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </div>
                    <span className="text-slate-300">{objective}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
            
            <TabsContent value="approach" className="pt-6">
              <h3 className="text-xl font-bold mb-4">Approach & Methodology</h3>
              <ul className="space-y-3">
                {project.approach.map((step, index) => (
                  <li key={index} className="flex items-start">
                    <div className="min-w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center mr-3">
                      {index + 1}
                    </div>
                    <span className="text-slate-300 mt-1">{step}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
            
            <TabsContent value="outcomes" className="pt-6">
              <h3 className="text-xl font-bold mb-4">Results & Outcomes</h3>
              <ul className="space-y-2">
                {project.outcomes.map((outcome, index) => (
                  <li key={index} className="flex items-start">
                    <div className={`min-w-5 h-5 mt-1 rounded-full bg-green-900/50 text-green-400 flex items-center justify-center mr-3`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5"/>
                      </svg>
                    </div>
                    <span className="text-slate-300">{outcome}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
            
            <TabsContent value="technologies" className="pt-6">
              <h3 className="text-xl font-bold mb-4">Technologies Used</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {project.technologies.map((tech, index) => (
                  <div key={index} className="flex items-center bg-slate-800/50 rounded-lg p-3">
                    <div className="w-10 h-10 mr-3 flex items-center justify-center">
                      {tech.icon ? (
                        <img src={tech.icon} alt={tech.name} className="h-8" />
                      ) : (
                        <Code size={24} className="text-slate-400" />
                      )}
                    </div>
                    <span>{tech.name}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Code snippet or dashboard preview */}
          {project.id === 'dunkin-donuts' && (
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-4">Forecast Dashboard Preview</h3>
              <div className="rounded-lg overflow-hidden">
                <img 
                  src="/projects/demand-forecast.png" 
                  alt="Dunkin Forecast Dashboard"
                  className="w-full h-auto object-cover"
                />
              </div>
            </div>
          )}
        </div>
        
        <div className="flex justify-between mt-8 pt-6 border-t border-slate-800">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          
          {project.links.github && (
            <a 
              href={project.links.github} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button className="gap-2">
                <Github size={16} />
                View on GitHub
              </Button>
            </a>
          )}
        </div>
      </div>
    );
  };
  

// Project data
const projects = [
  {
    id: 'dunkin-donuts',
    title: 'Dunkin\' Donuts Time Series Demand Forecast',
    shortDescription: 'Predictive model for demand forecasting using Dunkin’ UAE sales data',
    description: 'Developed a sophisticated time series forecasting model to predict demand trends using Dunkin\' Donuts sales data. The model was trained on over 12 months of store-level transaction data, cleaned and structured for temporal analysis, and optimized to support operations across 80+ Dunkin\' UAE branches.',
    duration: 'October 2024 - April 2025',
    category: 'Data Science',
    tags: ['Python', 'Pandas', 'Scikit-Learn', 'Prophet', 'Time Series', 'API Integration'],
    featured: true,
    image: '/projects/dunkin.png',
    icon: <LineChart size={48} className="text-blue-500" />,
    color: 'blue',
    objectives: [
      'Develop a forecasting model with over 80% accuracy for short-term demand prediction',
      'Enable store-specific forecasting to improve accuracy and relevance across multiple UAE locations',
      'Create a flexible model that can adapt to seasonal trends and special events',
      'Provide actionable insights for inventory management and staff scheduling'
    ],
    approach: [
      'Collected and preprocessed 2 years of historical sales data for pattern recognition',
      'Performed extensive feature engineering to extract temporal features and patterns',
      'Developed and compared multiple forecasting methods (XGBoost, Prophet, NBeats)',
      'Mapped regional demand patterns by segmenting stores into clusters based on sales volume and location characteristics',
      'Implemented cross-validation techniques to ensure model robustness'
    ],
    outcomes: [
      'Achieved 93% accuracy in demand prediction for 7-day forecasts',
      'Enabled inventory insights by identifying top-selling categories and low-demand periods across 80+ stores',
      'Enabled forecasting of sales fluctuations aligned with historical promotions and seasonality trends',
      'Developed a frontend dashboard with interactive charts and dynamic filtering to aid store managers in inventory decisions'
    ],
    technologies: [
      { name: 'Python', icon: '/icons/python.svg' },
      { name: 'Pandas', icon: '/icons/pandas.svg' },
      { name: 'Scikit-Learn', icon: '/icons/sklearn.svg' }
    ],
    codeSnippet: `
# Time series forecasting with Prophet
from fbprophet import Prophet
import pandas as pd

# Prepare the data
df = pd.read_csv('sales_data.csv')
df['ds'] = pd.to_datetime(df['date'])
df['y'] = df['sales']

# Create and fit the model
model = Prophet(
    changepoint_prior_scale=0.05,
    seasonality_mode='multiplicative',
    daily_seasonality=True
)

model.fit(df)

# Make future predictions
future = model.make_future_dataframe(periods=30)

forecast = model.predict(future)
`,
    links: {
        github: 'https://github.com/mikaeel-faraz/dunkin-donuts-forecast',
        live: 'https://youtu.be/w99wA5T3Hv8'
    }
  },
  {
    id: 'real-estate',
    title: 'Real Estate Valuation Using Ensemble Machine Learning',
    shortDescription: 'Advanced property pricing model using ensemble techniques',
    description: 'Built and compared custom machine learning models utilizing boosting (XGBoost) and bagging techniques to create highly accurate real estate price predictions. The models were trained on a large dataset of property features and historical sale prices, with special attention to handling outliers and feature engineering.',
    duration: 'January 2025 - March 2025',
    category: 'Machine Learning',
    tags: ['PySpark', 'XGBoost', 'Ensemble Learning', 'Machine Learning', 'Regression'],
    featured: true,
    image: '/projects/skyline.png',
    icon: <BarChart size={48} className="text-green-500" />,
    color: 'green',
    objectives: [
      'Develop a robust property valuation model with less than 8% mean error',
      'Compare performance of different ensemble techniques (boosting vs bagging)',
      'Create a scalable preprocessing pipeline for large real estate datasets',
      'Identify and quantify the most influential features in property pricing'
    ],
    approach: [
      'Collected and cleaned data from multiple real estate sources using PySpark',
      'Applied advanced preprocessing techniques including outlier removal and normalization',
      'Engineered new features based on location, property characteristics, and market trends',
      'Built multiple models (Random Forest, Gradient Boosting, XGBoost) for comparison',
      'Implemented 10-fold cross-validation to ensure reliable performance metrics'
    ],
    outcomes: [
      'Achieved 6.4% mean absolute percentage error on test data',
      'XGBoost model outperformed other approaches with 15% improvement',
      'Identified key pricing factors with SHAP value analysis',
      'Deployed model API for integration with partner real estate platforms'
    ],
    technologies: [
      { name: 'PySpark', icon: '/icons/pyspark.svg' },
      { name: 'XGBoost', icon: '/icons/xgboost.svg' },
      { name: 'Scikit-Learn', icon: '/icons/sklearn.svg' },
      { name: 'Pandas', icon: '/icons/pandas.svg' }
    ],
    codeSnippet: `
# Ensemble model with XGBoost
import xgboost as xgb
from sklearn.model_selection import cross_val_score
from sklearn.metrics import mean_absolute_percentage_error

# Prepare data
X_train, X_test, y_train, y_test = train_test_split(features, target, test_size=0.2)

# Define XGBoost model with optimal parameters
xgb_model = xgb.XGBRegressor(
    n_estimators=300,
    learning_rate=0.05,
    max_depth=6,
    subsample=0.8,
    colsample_bytree=0.8,
    objective='reg:squarederror',
    random_state=42
)

# Train and evaluate with cross-validation
cv_scores = cross_val_score(
    xgb_model, 
    X_train, 
    y_train, 
    cv=10, 
    scoring='neg_mean_absolute_percentage_error'
)

print(f"Cross-validated MAPE: {-cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

# Train on full training data
xgb_model.fit(X_train, y_train)

# Evaluate on test data
y_pred = xgb_model.predict(X_test)
mape = mean_absolute_percentage_error(y_test, y_pred)
print(f"Test MAPE: {mape:.4f}")
`,
    links: {
      github: 'https://github.com/xdMikayu/CSCI316-XGBoost-Real-Estate-Prediction',
      live: 'https://property-valuation-model.example.com'
    }
  },
  {
    id: 'data-lake',
    title: 'Data Lake Architecture for Reem Finance',
    shortDescription: 'Scalable financial data architecture with real-time analytics',
    description: 'Developed a comprehensive data lake architecture for Reem Finance that integrates structured and semi-structured datasets using Azure Data Factory. The solution includes real-time ETL pipelines and Power BI dashboards that deliver actionable insights into customer demographics and transaction patterns.',
    duration: 'September 2024 - November 2024',
    category: 'Data Engineering',
    tags: ['Azure', 'Data Factory', 'Power BI', 'Data Lake', 'Financial Data'],
    featured: true,
    image: '/projects/reem-finance.png',
    icon: <Database size={48} className="text-purple-500" />,
    color: 'purple',
    objectives: [
      'Design a scalable data architecture supporting multiple data formats',
      'Implement secure and compliant data handling for financial information',
      'Create automated ETL processes for continuous data integration',
      'Develop interactive dashboards for real-time business intelligence'
    ],
    approach: [
      'Analyzed existing data sources and quality requirements',
      'Designed multi-layer data lake structure (raw, processed, and curated layers)',
      'Implemented Azure Data Factory pipelines for automated data ingestion',
      'Created data transformation workflows to standardize financial metrics',
      'Developed Power BI dashboards with drill-down capabilities for executive insights'
    ],
    outcomes: [
      'Reduced data processing time by 78% compared to previous solution',
      'Enabled real-time analytics for transaction monitoring',
      'Improved data governance with comprehensive audit trails',
      'Created executive dashboards that increased data-driven decision making'
    ],
    technologies: [
      { name: 'Azure', icon: '/icons/azure.svg' },
      { name: 'Data Factory', icon: '/icons/data-factory.svg' },
      { name: 'Power BI', icon: '/icons/powerbi.svg' },
      { name: 'Azure Synapse', icon: '/icons/synapse.png' },
      { name: 'SQL', icon: '/icons/sql.svg' }
    ],
    codeSnippet: `
// Azure Data Factory pipeline definition (JSON)
{
  "name": "FinancialDataIngestionPipeline",
  "properties": {
    "activities": [
      {
        "name": "CopyTransactionData",
        "type": "Copy",
        "inputs": [
          {
            "referenceName": "TransactionSource",
            "type": "DatasetReference"
          }
        ],
        "outputs": [
          {
            "referenceName": "RawDataLake",
            "type": "DatasetReference"
          }
        ],
        "typeProperties": {
          "source": {
            "type": "SqlSource",
            "sqlReaderQuery": "SELECT * FROM Transactions WHERE ModifiedDate >= @{pipeline().parameters.WindowStart} AND ModifiedDate < @{pipeline().parameters.WindowEnd}"
          },
          "sink": {
            "type": "ParquetSink",
            "storeSettings": {
              "type": "AzureBlobFSWriteSettings"
            }
          }
        }
      }
    ],
    "parameters": {
      "WindowStart": {
        "type": "string"
      },
      "WindowEnd": {
        "type": "string"
      }
    }
  }
}
`,
    links: {
      github: 'https://github.com/xdMikayu/ReemFinance-Onboarding-Data-Lake',
      live: null
    }
  },
  {
    id: 'flappy-bird-ai',
    title: 'AI-Powered Game Agent Using NEAT for Flappy Bird',
    shortDescription: 'Self-learning AI that masters Flappy Bird through evolution',
    description: 'Developed an autonomous Flappy Bird AI agent that uses NeuroEvolution of Augmenting Topologies (NEAT) to evolve neural networks capable of playing the game without explicit programming. The AI improves through generations by selecting the best-performing neural networks based on fitness evaluation.',
    duration: 'September 2024 - November 2024',
    category: 'Artificial Intelligence',
    tags: ['NEAT', 'Neural Networks', 'Python', 'Pygame', 'Evolutionary Algorithms'],
    featured: false,
    image: '/projects/flappy-bird.jpg',
    icon: <Cpu size={48} className="text-yellow-500" />,
    color: 'yellow',
    objectives: [
      'Create a self-learning AI that can master Flappy Bird through evolutionary techniques',
      'Implement a NEAT algorithm for neural network evolution',
      'Design an appropriate fitness function to guide the learning process',
      'Visualize the learning progress and neural network structure'
    ],
    approach: [
      'Recreated Flappy Bird game environment using Pygame',
      'Implemented NEAT algorithm to evolve neural networks',
      'Designed a fitness function based on survival time and obstacles passed',
      'Created a population of neural networks with random initial weights',
      'Implemented selection, crossover, and mutation operations for evolution'
    ],
    outcomes: [
      'AI achieved perfect gameplay after 27 generations of evolution',
      'Created visualization tools to observe neural network decision-making',
      'Demonstrated the effectiveness of evolutionary algorithms for game AI',
      'Open-sourced the project for educational purposes'
    ],
    technologies: [
      { name: 'Python', icon: '/icons/python.svg' },
      { name: 'NEAT', icon: '/icons/neat.svg' },
      { name: 'Pygame', icon: '/icons/pygame.svg' },
      { name: 'NumPy', icon: '/icons/numpy.svg' }
    ],
    codeSnippet: `
# NEAT implementation for Flappy Bird
import neat
import pygame
import numpy as np

# Configure NEAT
config = neat.Config(
    neat.DefaultGenome,
    neat.DefaultReproduction,
    neat.DefaultSpeciesSet,
    neat.DefaultStagnation,
    'config.txt'
)

# Initialize population
population = neat.Population(config)

# Add reporters for progress tracking
population.add_reporter(neat.StdOutReporter(True))
stats = neat.StatisticsReporter()
population.add_reporter(stats)

# Fitness function
def eval_genomes(genomes, config):
    for genome_id, genome in genomes:
        game = FlappyBird()
        neural_network = neat.nn.FeedForwardNetwork.create(genome, config)
        
        # Set initial fitness
        genome.fitness = 0
        
        # Game loop
        while game.active:
            # Get game state as input
            inputs = game.get_state_as_input()
            
            # Get neural network output
            output = neural_network.activate(inputs)
            
            # Decide action based on output
            if output[0] > 0.5:  # Threshold for action
                game.bird_jump()
                
            # Update game state
            game.update()
            
            # Update fitness based on survival and progress
            genome.fitness = game.score * 10 + game.distance

# Run evolution
winner = population.run(eval_genomes, 50)  # 50 generations max

# Save the winner
with open('winner.pkl', 'wb') as f:
    pickle.dump(winner, f)
`,
    links: {
      github: 'https://github.com/xdMikayu/CSCI218-NEAT-AI-FlappyBird',
      live: 'https://flappy-bird-ai-demo.example.com'
    }
  },
  {
    id: 'seating-plan',
    title: 'Seating Plan Allocation Program for Dubai Transport',
    shortDescription: 'Dynamic seating management system with cultural sensitivity',
    description: 'Designed and implemented a real-time seating allocation program in C++ for Dubai\'s transport network that accounts for gender and age considerations. The system enables efficient seat assignments while respecting cultural norms and accessibility requirements.',
    duration: 'September 2023 - December 2023',
    category: 'Software Development',
    tags: ['C++', 'OOP', 'JSON', 'Algorithm Design', 'User Interface'],
    featured: false,
    image: '/projects/seating.jpeg',
    icon: <Layers size={48} className="text-red-500" />,
    color: 'red',
    objectives: [
      'Develop a seating allocation system that considers gender and age factors',
      'Implement real-time updates for changing passenger needs',
      'Create an intuitive visualization of the seating arrangement',
      'Design efficient algorithms for optimal seat assignment'
    ],
    approach: [
      'Analyzed cultural requirements and accessibility needs for Dubai transport',
      'Designed object-oriented architecture with passenger and seat classes',
      'Implemented priority-based allocation algorithms for special needs passengers',
      'Created a console-based visualization system for seat status',
      'Developed file I/O for journey configuration and state persistence'
    ],
    outcomes: [
      'Reduced boarding time by 35% through optimized seating arrangements',
      'Increased passenger satisfaction scores in system testing',
      'Successfully balanced cultural sensitivity with operational efficiency',
      'System adopted for further development by the transport authority'
    ],
    technologies: [
      { name: 'C++', icon: '/icons/cpp.svg' },
      { name: 'JSON', icon: '/icons/json.svg' },
      { name: 'Git', icon: '/icons/git.svg' }
    ],
    codeSnippet: `
// C++ Object-Oriented Implementation
#include <iostream>
#include <vector>
#include <string>
#include <memory>
#include "json.hpp"

// Passenger class with attributes
class Passenger {
private:
    std::string id;
    std::string name;
    std::string gender;
    int age;
    bool special_needs;

public:
    Passenger(std::string id, std::string name, 
              std::string gender, int age, bool special_needs)
        : id(id), name(name), gender(gender), 
          age(age), special_needs(special_needs) {}
    
    // Getters
    std::string get_gender() const { return gender; }
    int get_age() const { return age; }
    bool has_special_needs() const { return special_needs; }
    
    // For display
    std::string get_display_name() const {
        return name.substr(0, 1) + ".";
    }
};

// Seat allocation logic
class SeatingPlan {
private:
    std::vector<std::vector<std::shared_ptr<Passenger>>> seats;
    int rows;
    int cols;
    
public:
    SeatingPlan(int rows, int cols) : rows(rows), cols(cols) {
        seats.resize(rows, std::vector<std::shared_ptr<Passenger>>(cols, nullptr));
    }
    
    bool allocate_seat(std::shared_ptr<Passenger> passenger) {
        // Priority allocation for special needs passengers
        if (passenger->has_special_needs()) {
            return allocate_special_needs_seat(passenger);
        }
        
        // Gender-based allocation
        if (passenger->get_gender() == "female") {
            return allocate_female_seat(passenger);
        } else {
            return allocate_male_seat(passenger);
        }
    }
    
    // Methods for specific allocation strategies
    bool allocate_special_needs_seat(std::shared_ptr<Passenger> passenger) {
        // Implementation for special needs seating
    }
    
    bool allocate_female_seat(std::shared_ptr<Passenger> passenger) {
        // Implementation for female passenger seating
    }
    
    bool allocate_male_seat(std::shared_ptr<Passenger> passenger) {
        // Implementation for male passenger seating
    }
    
    void display_seating_plan() {
        // Visual representation of the seating plan
    }
};
`,
    links: {
      github: 'https://github.com/mikaeel-faraz/dubai-transport-seating',
      live: null
    }
  },
  {
    id: 'automobile-sales',
    title: 'Automobile Sales Management System',
    shortDescription: 'Comprehensive Java GUI application for vehicle sales management',
    description: 'Designed and implemented a comprehensive GUI-based system for managing automobile sales, inventory, and customer interactions. The system features role-based access control, allowing both customers and administrators to interact with the platform according to their privileges.',
    duration: 'May 2023 - August 2023',
    category: 'Software Development',
    tags: ['Java', 'Swing', 'GUI', 'OOP', 'Database', 'Authentication'],
    featured: false,
    image: '/projects/uml.png',
    icon: <Monitor size={48} className="text-cyan-500" />,
    color: 'cyan',
    objectives: [
      'Create a user-friendly interface for automobile inventory management',
      'Implement secure authentication for different user roles',
      'Design an object-oriented architecture with inheritance for vehicle types',
      'Develop comprehensive receipt generation and tracking functionality'
    ],
    approach: [
      'Designed the system architecture with MVC pattern',
      'Implemented inheritance hierarchy for different vehicle categories',
      'Created a relational database schema for data persistence',
      'Developed Swing-based GUI with responsive layouts',
      'Implemented security features for user authentication and authorization'
    ],
    outcomes: [
      'Successfully deployed system for a local automobile dealer',
      'Reduced administrative overhead by 40% through automation',
      'Improved inventory tracking accuracy to 99.8%',
      'Enhanced customer experience through streamlined purchasing process'
    ],
    technologies: [
      { name: 'Java', icon: '/icons/java.svg' },
      { name: 'MySQL', icon: '/icons/mysql.svg' }
    ],
    codeSnippet: `
// Java class hierarchy for vehicle management
import java.util.ArrayList;
import java.util.Date;
import java.io.Serializable;

// Abstract base class for all vehicles
public abstract class Vehicle implements Serializable {
    protected String vin;
    protected String make;
    protected String model;
    protected int year;
    protected double basePrice;
    protected boolean available;
    
    // Constructor
    public Vehicle(String vin, String make, String model, 
                   int year, double basePrice) {
        this.vin = vin;
        this.make = make;
        this.model = model;
        this.year = year;
        this.basePrice = basePrice;
        this.available = true;
    }
    
    // Abstract method to calculate final price
    public abstract double calculatePrice();
    
    // Getters and setters
    public String getVin() { return vin; }
    public String getMake() { return make; }
    public String getModel() { return model; }
    public int getYear() { return year; }
    public double getBasePrice() { return basePrice; }
    public boolean isAvailable() { return available; }
    
    public void setAvailable(boolean available) { 
        this.available = available; 
    }
    
    @Override
    public String toString() {
        return year + " " + make + " " + model;
    }
}

// Car subclass
public class Car extends Vehicle {
    private int numDoors;
    private String bodyType;
    private double fuelEfficiency;
    
    public Car(String vin, String make, String model, int year, 
               double basePrice, int numDoors, String bodyType, 
               double fuelEfficiency) {
        super(vin, make, model, year, basePrice);
        this.numDoors = numDoors;
        this.bodyType = bodyType;
        this.fuelEfficiency = fuelEfficiency;
    }
    
    @Override
    public double calculatePrice() {
        // Cars have special pricing based on body type and fuel efficiency
        double price = basePrice;
        
        // Premium for certain body types
        if (bodyType.equalsIgnoreCase("Sedan")) {
            price *= 1.05;
        } else if (bodyType.equalsIgnoreCase("SUV")) {
            price *= 1.1;
        } else if (bodyType.equalsIgnoreCase("Sports")) {
            price *= 1.15;
        }
        
        // Adjust for fuel efficiency
        if (fuelEfficiency > 30) {
            price *= 1.05; // Premium for high efficiency
        }
        
        return price;
    }
    
    // Additional getters
    public int getNumDoors() { return numDoors; }
    public String getBodyType() { return bodyType; }
    public double getFuelEfficiency() { return fuelEfficiency; }
}
`,
    links: {
      github: 'https://github.com/xdMikayu/CSIT121-Automobile-Sales-System',
      live: null
    }
  },
  {
    id: 'face-mask-detection',
    title: 'Face Mask Detection using Transfer Learning',
    shortDescription: 'Classifies mask usage using InceptionV3 and real-time image augmentation',
    description: 'Developed a deep learning model using transfer learning (InceptionV3) to classify face mask usage into three categories: mask, no mask, and incorrect mask. The project involved image preprocessing, augmentation using OpenCV and Keras, model training with TensorFlow, and evaluation using classification metrics. Data was sourced from Kaggle and refined through annotation parsing and normalization.',
    duration: 'February 2025 - April 2025',
    category: 'Machine Learning',
    tags: ['TensorFlow', 'Keras', 'OpenCV', 'InceptionV3', 'Transfer Learning', 'Image Classification'],
    featured: false,
    image: '/projects/mask.png',
    icon: <Monitor size={48} className="text-pink-500" />,
    color: 'pink',
    objectives: [
      'Develop a CNN model using transfer learning to classify mask usage',
      'Implement data cleaning and XML-based annotation processing',
      'Apply image normalization and augmentation for model generalization',
      'Evaluate model with accuracy, precision, recall, and confusion matrix'
    ],
    approach: [
      'Parsed and labeled image dataset using XML annotations',
      'Applied OpenCV and PIL for cleaning, resizing, and format standardization',
      'Used ImageDataGenerator for real-time data augmentation in training loop',
      'Fine-tuned the InceptionV3 model with custom classification layers',
      'Evaluated and deployed the final model for inference with `.h5` export'
    ],
    outcomes: [
      'Achieved 85% accuracy in classifying face mask usage',
      'Reduced model overfitting with real-time augmentation and dropout',
      'Enabled scalable deployment with saved model format',
      'Demonstrated model performance in a final presentation and video demo'
    ],
    technologies: [
      { name: 'TensorFlow', icon: '/icons/tensorflow.svg' },
      { name: 'Keras', icon: '/icons/keras.svg' },
      { name: 'OpenCV', icon: '/icons/opencv.svg' },
      { name: 'Python', icon: '/icons/python.svg' }
    ],
    codeSnippet: `
# Load and evaluate trained InceptionV3 model
from tensorflow.keras.models import load_model
model = load_model('face_mask_detector.h5')

# Predict on a sample image
from tensorflow.keras.preprocessing import image
import numpy as np

img = image.load_img('sample.jpg', target_size=(128, 128))
img_array = image.img_to_array(img) / 255.0
img_array = np.expand_dims(img_array, axis=0)

prediction = model.predict(img_array)
print("Predicted Class:", prediction.argmax())
`,
    links: {
      github: 'https://github.com/xdMikayu/CSCI316-Mask-Detection-Transferlearning',
      live: 'https://youtu.be/qn3jjj9sXQY'
    }
  }
];

