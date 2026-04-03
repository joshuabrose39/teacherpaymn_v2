import React from 'react';

export default function AboutProject() {
  return (
    <div className="card">
      <div className="card-body">
        <div className="page-header">
          <div className="page-title">
            <h2>About the Author</h2>
          </div>
        </div>

        <div className="about-author-photo-wrap">
          <img className="about-author-photo" src="/portrait.jpg" alt="Joshua Brose" />
        </div>

        <div className="profile-field-list">
          <p>
            Joshua Brose is a System Administrator and Data Analyst at Hmong College Prep Academy in
            the Twin Cities, Minnesota. With over a decade of experience in education, he has held a
            range of roles including paraprofessional, mathematics teacher, interventionist, and
            technology lead before transitioning into district-level data systems leadership.
          </p>
          <p>
            Brose specializes in K-12 data infrastructure, with a focus on making educational data
            accessible, reliable, and actionable for all stakeholders. He manages core enterprise
            systems such as PowerSchool and Schoology, oversees state reporting and compliance
            processes, and develops custom SQL-based reporting solutions to support both operational
            efficiency and student outcomes. His work includes designing and maintaining a
            district-level data warehouse, with an emphasis on secure data practices and emerging
            applications of AI to streamline workflows and enhance decision-making.
          </p>
          <p>
            He holds a master's degree in Urban Education from Metropolitan State University.
          </p>
          <p>
            Brose is a strong advocate for data transparency in education. He believes that public
            data should be genuinely accessible, not just technically available, and that meaningful
            access requires thoughtful design, clear presentation, and practical tools. His work on
            teacher salary data reflects this philosophy, aiming to make complex public datasets
            understandable and usable for educators navigating career and compensation decisions.
          </p>
        </div>
      </div>
    </div>
  );
}
