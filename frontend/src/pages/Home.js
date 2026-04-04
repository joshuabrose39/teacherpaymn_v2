import React from 'react';
import { NavLink } from 'react-router-dom';

const featureCards = [
  {
    title: 'School Map',
    path: '/school-map',
    eyebrow: 'Map and school profiles',
    description:
      'Browse schools across Minnesota, size circles by enrollment, and compare salary, demographics, and district context in one view.',
    bullets: [
      'See where schools are located',
      'Filter by district type and classification',
      'Compare enrollment and median pay',
    ],
    previewImage: '/home/salary-finder.jpg',
    previewAlt: 'Compare Pay dashboard screenshot',
    previewClass: 'home-preview-image home-preview-image-salary',
    cta: 'Open School Map',
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
    previewImage: '/home/school-map.jpg',
    previewAlt: 'School Map dashboard screenshot',
    previewClass: 'home-preview-image home-preview-image-map',
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
    previewImage: '/home/scatterplot.jpg',
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
        </div>
      </section>

      <section className="home-feature-stack">
        {featureCards.map((card) => (
          <article key={card.title} className="home-feature-card">
            <div className="home-feature-content">
              <div className="home-feature-eyebrow">{card.eyebrow}</div>
              <h3>
                <NavLink
                  to={card.path}
                  className={({ isActive }) => (isActive ? 'home-feature-title-link active' : 'home-feature-title-link')}
                  tabIndex={0}
                >
                  {card.title}
                </NavLink>
              </h3>
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
                <NavLink
                  to={card.path}
                  className={({ isActive }) => (isActive ? 'home-feature-image-link active' : 'home-feature-image-link')}
                  tabIndex={0}
                  aria-label={card.cta}
                >
                  <div className={`home-feature-preview ${card.previewClass}`}>
                    <img src={card.previewImage} alt={card.previewAlt} />
                  </div>
                </NavLink>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}
