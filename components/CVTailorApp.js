import React, { useState, useEffect } from 'react';
import { Upload, Download, Sparkles, FileText, Briefcase, AlertCircle, CheckCircle, Target, TrendingUp, Award, Eye } from 'lucide-react';

const CVTailorApp = () => {
  const [cvFile, setCvFile] = useState(null);
  const [cvText, setCvText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tailoredCV, setTailoredCV] = useState('');
  const [atsScore, setAtsScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [processingStep, setProcessingStep] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Load PDF.js
  useEffect(() => {
    const loadPDFJS = async () => {
      if (!window.pdfjsLib) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        };
        document.head.appendChild(script);
      }
    };
    loadPDFJS();
  }, []);

  // Extract text from PDF using PDF.js
  const extractPDFText = async (file) => {
    try {
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        throw new Error('PDF.js not loaded');
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
      }

      return fullText;
    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error('Could not extract text from PDF. Please try uploading a text file instead.');
    }
  };

  // Handle file upload with automatic text extraction
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setCvFile(file);
    setError('');
    setProcessingStep('Extracting text from your CV...');

    try {
      if (file.type === 'application/pdf') {
        const text = await extractPDFText(file);
        setCvText(text);
        setProcessingStep('');
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const text = await file.text();
        setCvText(text);
        setProcessingStep('');
      } else {
        setError('Please upload a PDF or TXT file');
        setCvFile(null);
        setProcessingStep('');
      }
    } catch (err) {
      setError(err.message);
      setCvFile(null);
      setProcessingStep('');
    }
  };

  // Calculate ATS score
  const calculateATSScore = async (cvContent, jobDesc) => {
    try {
      const response = await fetch('/api/ats-score', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvContent,
          jobDescription: jobDesc
        })
      });

      if (!response.ok) {
        throw new Error('Failed to calculate ATS score');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('ATS Score error:', err);
      return {
        score: 0,
        breakdown: {
          keywords: 0,
          skills: 0,
          experience: 0,
          format: 0,
          structure: 0
        },
        recommendations: ['Unable to calculate score. Please try again.']
      };
    }
  };

  // Tailor CV with ATS optimization
  const tailorCV = async () => {
    if (!cvText.trim() || !jobDescription.trim()) {
      setError('Please provide both CV and job description');
      return;
    }

    setLoading(true);
    setError('');
    setTailoredCV('');
    setAtsScore(null);

    try {
      // Step 1: Analyze original CV
      setProcessingStep('Analyzing your CV for ATS compatibility...');
      const originalScore = await calculateATSScore(cvText, jobDescription);
      
      // Step 2: Tailor CV content
      setProcessingStep('Tailoring your CV for maximum ATS compatibility...');
      const response = await fetch('/api/tailor-cv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cvText,
          jobDescription
        })
      });

      if (!response.ok) {
        throw new Error('Failed to tailor CV');
      }

      const data = await response.json();
      const optimizedCV = data.tailoredCV;
      setTailoredCV(optimizedCV);

      // Step 3: Calculate final ATS score
      setProcessingStep('Calculating final ATS score...');
      const finalScore = await calculateATSScore(optimizedCV, jobDescription);
      setAtsScore(finalScore);

    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
      setProcessingStep('');
    }
  };

  // Enhanced CV formatting for Jake's Resume style
  const formatCVContent = (cvContent) => {
    const lines = cvContent.split('\n').filter(line => line.trim());
    let html = '';
    let currentSection = '';
    let inHeader = false;
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Skip empty lines
      if (!trimmed) return;
      
      // Detect name (usually first significant line)
      if (index === 0 || (index < 3 && trimmed.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) && !trimmed.includes('@'))) {
        if (!inHeader) {
          html += '<div class="header">';
          inHeader = true;
        }
        html += `<h1 class="name">${trimmed}</h1>`;
        return;
      }
      
      // Detect contact info
      if (trimmed.match(/^[\w\.-]+@[\w\.-]+\.\w+/) || trimmed.match(/^\+?\d/) || trimmed.match(/linkedin/i) || trimmed.match(/github/i)) {
        if (!inHeader) {
          html += '<div class="header">';
          inHeader = true;
        }
        html += `<div class="contact-info">${trimmed}</div>`;
        return;
      }
      
      // Close header if we're past contact info
      if (inHeader && !trimmed.match(/^[\w\.-]+@[\w\.-]+\.\w+/) && !trimmed.match(/^\+?\d/) && !trimmed.match(/linkedin/i)) {
        html += '</div>';
        inHeader = false;
      }
      
      // Detect section headers
      if (trimmed.match(/^(CONTACT|PROFESSIONAL SUMMARY|SUMMARY|WORK EXPERIENCE|EXPERIENCE|SKILLS|EDUCATION|PROJECTS|CERTIFICATIONS|ACHIEVEMENTS)/i)) {
        if (currentSection && !inHeader) html += '</div>';
        currentSection = trimmed;
        html += `<div class="section"><h2 class="section-title">${trimmed}</h2>`;
        return;
      }
      
      // Job titles and companies
      if (trimmed.match(/^[A-Z][a-zA-Z\s]+$/) && trimmed.length < 50 && !trimmed.includes('.') && currentSection.toLowerCase().includes('experience')) {
        html += `<div class="job-title">${trimmed}</div>`;
        return;
      }
      
      // Company names (lines with common company indicators)
      if (trimmed.match(/(Inc\.|LLC|Corp|Company|Ltd|Technologies|Solutions|Systems)/i) && currentSection.toLowerCase().includes('experience')) {
        html += `<div class="company">${trimmed}</div>`;
        return;
      }
      
      // Dates (various formats)
      if (trimmed.match(/\d{4}/) && (trimmed.match(/\-/) || trimmed.match(/to/i) || trimmed.match(/present/i))) {
        html += `<div class="date">${trimmed}</div>`;
        return;
      }
      
      // Skills section formatting
      if (currentSection.toLowerCase().includes('skill')) {
        if (trimmed.includes(':')) {
          const [category, skills] = trimmed.split(':');
          html += `<div class="skill-category"><h4>${category.trim()}</h4><p>${skills.trim()}</p></div>`;
        } else {
          html += `<div class="skill-category"><p>${trimmed}</p></div>`;
        }
        return;
      }
      
      // Education formatting
      if (currentSection.toLowerCase().includes('education')) {
        if (trimmed.match(/^(Bachelor|Master|PhD|Associate|Certificate)/i)) {
          html += `<div class="education-item"><div class="degree">${trimmed}</div>`;
        } else if (trimmed.match(/(University|College|Institute|School)/i)) {
          html += `<div class="school">${trimmed}</div></div>`;
        } else {
          html += `<div class="date">${trimmed}</div>`;
        }
        return;
      }
      
      // Bullet points and descriptions
      if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
        html += `<div class="description"><ul><li>${trimmed.substring(1).trim()}</li></ul></div>`;
      } else if (currentSection.toLowerCase().includes('summary')) {
        html += `<div class="summary">${trimmed}</div>`;
      } else {
        html += `<div class="description"><p>${trimmed}</p></div>`;
      }
    });
    
    // Close any open sections
    if (currentSection && !inHeader) html += '</div>';
    if (inHeader) html += '</div>';
    
    return html || `<div class="section"><div class="summary">${cvContent}</div></div>`;
  };

  // Download tailored CV as styled HTML
  const downloadCV = () => {
    if (!tailoredCV) return;

    const styledHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ATS-Optimized Resume</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #fff;
            padding: 40px 20px;
            max-width: 800px;
            margin: 0 auto;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #2563eb;
        }
        
        .name {
            font-size: 2.8em;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 15px;
            letter-spacing: -0.5px;
        }
        
        .contact-info {
            font-size: 1.1em;
            color: #4b5563;
            margin-bottom: 8px;
            font-weight: 500;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section-title {
            font-size: 1.5em;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 20px;
            padding-bottom: 8px;
            border-bottom: 2px solid #e5e7eb;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .job-title {
            font-size: 1.3em;
            font-weight: 700;
            color: #374151;
            margin-bottom: 8px;
            margin-top: 20px;
        }
        
        .company {
            font-size: 1.15em;
            color: #2563eb;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .date {
            font-size: 1em;
            color: #6b7280;
            font-style: italic;
            margin-bottom: 12px;
            font-weight: 500;
        }
        
        .description {
            margin-bottom: 15px;
            padding-left: 0;
        }
        
        .description ul {
            list-style-type: none;
            padding-left: 0;
        }
        
        .description li {
            margin-bottom: 8px;
            padding-left: 25px;
            position: relative;
            line-height: 1.7;
        }
        
        .description li:before {
            content: "▸";
            color: #2563eb;
            position: absolute;
            left: 0;
            top: 0;
            font-weight: bold;
            font-size: 1.1em;
        }
        
        .description p {
            margin-bottom: 10px;
            line-height: 1.7;
            text-align: justify;
        }
        
        .skill-category {
            background: #f8fafc;
            padding: 20px;
            border-radius: 10px;
            border-left: 5px solid #2563eb;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 15px;
        }
        
        .skill-category h4 {
            font-size: 1.15em;
            font-weight: 700;
            color: #1e40af;
            margin-bottom: 10px;
        }
        
        .skill-category p {
            font-size: 1em;
            color: #4b5563;
            line-height: 1.6;
        }
        
        .education-item {
            margin-bottom: 20px;
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
        }
        
        .degree {
            font-size: 1.2em;
            font-weight: 700;
            color: #374151;
            margin-bottom: 5px;
        }
        
        .school {
            font-size: 1.1em;
            color: #2563eb;
            font-weight: 600;
            margin-bottom: 5px;
        }
        
        .summary {
            font-size: 1.1em;
            line-height: 1.8;
            color: #374151;
            text-align: justify;
            background: #f8fafc;
            padding: 25px;
            border-radius: 10px;
            border-left: 5px solid #2563eb;
        }
        
        .summary strong, .description strong {
            color: #1e40af;
            font-weight: 700;
        }
        
        .summary em, .description em {
            color: #6b7280;
            font-style: italic;
        }
        
        @media print {
            body {
                padding: 0;
                font-size: 11px;
            }
            
            .name {
                font-size: 2.2em;
            }
            
            .section-title {
                font-size: 1.3em;
            }
            
            .header {
                margin-bottom: 20px;
            }
            
            .section {
                margin-bottom: 20px;
            }
        }
        
        @media (max-width: 600px) {
            .name {
                font-size: 2.2em;
            }
        }
    </style>
</head>
<body>
    <div class="resume-content">
        ${formatCVContent(tailoredCV)}
    </div>
</body>
</html>`;

    const blob = new Blob([styledHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ats_optimized_resume.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get score color
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBgColor = (score) => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
            <Target className="text-purple-600" />
            ATS-Optimized CV Tailor
          </h1>
          <p className="text-gray-600 text-lg">
            Upload your CV, paste job description, get ATS-optimized resume! 🎯
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Award className="h-4 w-4 text-green-600" />
              <span>ATS Optimized</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span>High ATS Score</span>
            </div>
            <div className="flex items-center gap-1">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span>Professional Styling</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6 mb-6">
          {/* CV Upload Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="text-blue-600" />
              Upload Your CV
            </h2>
            
            <div className="mb-4">
              <label className="block w-full">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors cursor-pointer">
                  <Upload className="mx-auto h-10 w-10 text-gray-400 mb-3" />
                  <p className="text-gray-600 font-medium">
                    Click to upload PDF or TXT file
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    PDF text will be extracted automatically
                  </p>
                </div>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {processingStep && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-sm">{processingStep}</span>
                </div>
              </div>
            )}

            {cvFile && !processingStep && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Uploaded: {cvFile.name}
                </p>
              </div>
            )}

            {cvText && (
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    Extracted CV Content
                  </label>
                  <button
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-blue-600 text-sm flex items-center gap-1 hover:text-blue-800"
                  >
                    <Eye className="h-4 w-4" />
                    {showPreview ? 'Hide' : 'Preview'}
                  </button>
                </div>
                
                {showPreview && (
                  <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto border">
                    <pre className="text-sm text-gray-700 whitespace-pre-wrap">
                      {cvText.substring(0, 500)}...
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Job Description Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Briefcase className="text-purple-600" />
              Job Description
            </h2>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the complete job description including requirements, responsibilities, and qualifications..."
                className="w-full h-64 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
              />
            </div>

            <button
              onClick={tailorCV}
              disabled={loading || !cvText.trim() || !jobDescription.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span className="text-sm">{processingStep}</span>
                </>
              ) : (
                <>
                  <Target className="h-5 w-5" />
                  Optimize CV for ATS
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* ATS Score Display */}
        {atsScore && (
          <div className="mb-6 bg-white rounded-lg shadow-md p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="text-blue-600" />
              ATS Compatibility Score
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="text-center">
                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${getScoreBgColor(atsScore.score)} mb-4`}>
                  <span className={`text-3xl font-bold ${getScoreColor(atsScore.score)}`}>
                    {atsScore.score}
                  </span>
                </div>
                <p className="text-lg font-semibold text-gray-700">Overall ATS Score</p>
                <p className={`text-sm ${getScoreColor(atsScore.score)}`}>
                  {atsScore.score >= 80 ? 'Excellent!' : atsScore.score >= 60 ? 'Good' : 'Needs Improvement'}
                </p>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-gray-700 mb-3">Score Breakdown:</h4>
                {atsScore.breakdown && Object.entries(atsScore.breakdown).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 capitalize">{key}:</span>
                    <span className={`font-semibold ${getScoreColor(value)}`}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {atsScore.recommendations && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-2">Recommendations:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  {atsScore.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-blue-500 mt-1">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {tailoredCV && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Award className="text-green-600" />
                ATS-Optimized CV (Jake's Resume Style)
              </h2>
              <button
                onClick={downloadCV}
                className="bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Styled Resume
              </button>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">
                {tailoredCV}
              </pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Free ATS optimization tool with professional styling. 
            Your data is processed securely and never stored.
          </p>
          <p className="mt-2">
            Made with ❤️ for the job seeking community | 
            <span className="text-purple-600"> Helping you land your dream job!</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CVTailorApp;
