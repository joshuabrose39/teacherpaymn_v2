import React from 'react';
import { NavLink } from 'react-router-dom';

const featureCards = [
  {
    title: 'Schools',
    path: '/school-map',
    eyebrow: 'Map and school profiles',
    description:
      'Browse schools across Minnesota, size circles by enrollment, and compare salary, demographics, and district context in one view.',
    bullets: [
      'See where schools are located',
      'Filter by district type and classification',
      'Compare enrollment and median pay',
    ],
    previewImage: '/home/school-map.png',
    previewAlt: 'Schools dashboard screenshot',
    previewClass: 'home-preview-image home-preview-image-map',
    cta: 'Open Schools',
  },
  {
    title: 'Compare Pay',
    path: '/salary-finder',
    eyebrow: 'Salary comparison tool',
    description:
      'Filter teachers and other educators by role, experience, education, location, and year to compare salary ranges and summary statistics.',
    bullets: [
      'View salary distributions',
      'Compare similar educators side by side',
      'Check median and average pay quickly',
    ],
    previewImage: '/home/salary-finder.png',
    previewAlt: 'Compare Pay dashboard screenshot',
    previewClass: 'home-preview-image home-preview-image-salary',
    cta: 'Open Compare Pay',
  },
  {
    title: 'Pay vs. Experience',
    path: '/scatterplot',
    eyebrow: 'Trend explorer',
    description:
      'Plot salary against years of experience to spot patterns, outliers, and district-type differences across the state.',
    bullets: [
      'See how pay changes with experience',
      'Explore large statewide patterns',
      'Filter down to individual educator groups',
    ],
    previewImage: '/home/scatterplot.png',
    previewAlt: 'Pay vs. Experience dashboard screenshot',
    previewClass: 'home-preview-image home-preview-image-scatter',
    cta: 'Open Pay vs. Experience',
  },
  {
    title: 'About the Data',
    path: '/methodology',
    eyebrow: 'Methods and coverage',
    description:
      'Understand where the data comes from, which school years are covered, and how records were prepared for the public dashboards.',
    bullets: [
      'Read data methods in plain language',
      'See coverage and limitations',
      'Understand what each dashboard represents',
    ],
    cta: 'Read About the Data',
  },
];

export default function Home() {
  return (
    <div className="home-page">
      <section className="card home-hero-card">
        <div className="card-body home-hero-body">
          <div className="home-kicker">Minnesota public salary explorer</div>
          <h1 className="home-title">Understand teacher pay across Minnesota</h1>
          <p className="home-lead">
            Minnesota Teacher Pay helps you explore school-level patterns, compare educator salaries,
            and understand how pay changes with experience using public data from the Minnesota
            Professional Educator Licensing and Standards Board. It is designed for teachers, families,
            journalists, and researchers who want a clearer view of school pay patterns, salary ranges,
            and statewide trends.
          </p>
          <div className="home-link-row" aria-label="Quick links">
            <NavLink to="/salary-finder" className="home-inline-link">Compare Pay</NavLink>
            <NavLink to="/school-map" className="home-inline-link">Explore Schools</NavLink>
            <NavLink to="/methodology" className="home-inline-link">About the Data</NavLink>
          </div>
        </div>
      </section>

      <section className="card home-section-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Start here</h2>
            <div className="card-subtitle">
              Choose the tool that matches the question you are trying to answer.
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="home-feature-stack">
            {featureCards.map((card) => (
              <NavLink key={card.title} to={card.path} className="home-feature-link">
                <article className="home-feature-card">
                  <div className="home-feature-content">
                    <div className="home-feature-eyebrow">{card.eyebrow}</div>
                    <h3>{card.title}</h3>
                    <p>{card.description}</p>
                    <div className="home-bullet-list">
                      {card.bullets.map((bullet) => (
                        <div key={bullet} className="home-bullet-item">{bullet}</div>
                      ))}
                    </div>
                    <div className="home-feature-cta">{card.cta}</div>
                  </div>
                  {card.previewImage && (
                    <div className="home-feature-media">
                      <div className={`home-feature-preview ${card.previewClass}`}>
                        <img src={card.previewImage} alt={card.previewAlt} />
                      </div>
                    </div>
                  )}
                </article>
              </NavLink>
            ))}
          </div>
        </div>
      </section>

      <section className="card home-section-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Where the data comes from</h2>
            <div className="card-subtitle">
              Why the information on this site is credible and how it was prepared.
            </div>
          </div>
        </div>
        <div className="card-body">
          <div className="home-summary-block">
            <p>
              Minnesota Teacher Pay is built from publicly available reporting released by the
              Minnesota Professional Educator Licensing and Standards Board, or PELSB. Rather than
              collecting anecdotal or self-reported salary information, the site organizes official
              state-published records into tools that are easier to browse, compare, and understand.
            </p>
            <p>
              You can trust the site because the underlying records come from a public government data
              source and the methods used to prepare them are documented transparently. The dashboards
              are designed to make those records more usable, not to replace them. The About the Data
              page explains the sourcing, cleaning, matching, and limitations in plain language so you
              can see exactly what the site is showing and where caution is still appropriate.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
