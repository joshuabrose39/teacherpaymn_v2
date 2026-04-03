import React from 'react';

export default function Methodology() {
  return (
    <div className="card">
      <div className="card-body">
        <div className="page-header">
          <div className="page-title">
            <h2>About the Data</h2>
            <p>
              Detailed methods for Minnesota Teacher Pay, authored by Joshua Brose.
            </p>
          </div>
        </div>

        <section>
          <h3>Plain-Language Overview</h3>
          <p>
            We created this project to make Minnesota educator salary data more accessible to the people most
            affected by it, especially classroom teachers. The project is designed to help educators compare pay
            across districts and schools, evaluate potential job options, and use public salary information as a
            starting point for pay negotiations or collective bargaining discussions. Although the primary audience
            is educators, the site is also intended to be useful to legislators, unions, school boards, and other
            education stakeholders.
          </p>
          <p>
            The website is built from publicly available data reports published by the{' '}
            <a href="https://mn.gov/pelsb/board/data/" target="_blank" rel="noopener noreferrer">
              Professional Educator Licensing and Standards Board (PELSB) Data Reports
            </a>
            . We reorganized those reports into a longitudinal database, restored contextual fields that were stored
            separately in dimension tables, and then produced website-facing tables for interactive comparison tools.
            The goal was not only to make the data easier to search and visualize, but also to preserve the original
            record structure closely enough that users can recognize the information they would see in the source
            reports.
          </p>
        </section>

        <section>
          <h3>Project Purpose and Audience</h3>
          <p>
            The central purpose of the project is accessibility. PELSB salary and staffing reports are public, but
            they are not easy for most educators to search, compare, or interpret at scale. We therefore designed
            this site as a public-facing analytical layer over the underlying reports. The project supports three
            primary use cases: salary comparison, transparency through accessibility, and labor-market analysis.
          </p>
          <p>
            The intended audience is primarily the educators represented in the data. We also expect the site to be
            useful to unions, legislators, school boards, journalists, and other education stakeholders who need a
            clearer view of statewide compensation patterns and staffing arrangements.
          </p>
        </section>

        <section>
          <h3>Data Sources</h3>
          <p>
            The primary source materials are the annual{' '}
            <a href="https://mn.gov/pelsb/board/data/" target="_blank" rel="noopener noreferrer">
              PELSB Data Reports
            </a>
            . For educator salary and staffing analysis, we relied on three families of reports: the Staff Employment
            files, the Staff Assignment files, and the Educator License and Assignment files. In this project, Staff
            Employment and Staff Assignment data currently cover school years 2021-2022 through 2024-2025. License
            data currently cover school years 2021-2022, 2022-2023, and 2024-2025.
          </p>
          <p>
            We also used derived district- and school-level reference tables to restore document fields that were not
            retained directly in the fact tables after standardization. These reference tables provide fields such as
            district name, district county, service cooperative identifiers, school name, school county, and school
            classification. District organization categories were aligned to Minnesota Department of Education
            organization-type definitions published in the official{' '}
            <a href="https://pub.education.mn.gov/MdeOrgView/reference/orgTypes" target="_blank" rel="noopener noreferrer">
              MDE Organization Types
            </a>{' '}
            reference.
          </p>
        </section>

        <section>
          <h3>Coverage and Scope</h3>
          <p>
            Not every section of the website is built from the same unit of analysis or the same set of years. The
            Compare Pay and Pay vs. Experience pages currently include school years 2021-2022 through 2024-2025. The
            Educator Profile page currently includes employment and assignment records for 2021-2022 through
            2024-2025, and license records for 2021-2022, 2022-2023, and 2024-2025. The Schools page is more limited
            historically because some supporting school-level enrollment and location inputs are not yet available as
            a fully historical series in the current source database, so it should be interpreted separately from the
            all-years salary dashboards.
          </p>
        </section>

        <section>
          <h3>Data Processing Pipeline</h3>
          <p>
            We converted annual report files into a standardized analytical database. During ingestion, we harmonized
            field names across years, normalized data types, and mapped report columns into longitudinal fact and
            dimension tables. The standardized fact tables preserve the core record-level information on employments,
            assignments, and licenses, while dimension tables store contextual data such as district and school names,
            service cooperative affiliations, county information, school classifications, and district type labels.
            For the website, district types are also grouped into broader public-facing categories, and a small number
            of anomalous school-classification values are normalized for filter usability.
          </p>
          <p>
            One important example is District Type Category. Many educators think of both Special school districts,
            such as Minneapolis, and Independent school districts, such as Saint Paul, as traditional public schools,
            while having little familiarity with the full set of district-organization labels used in the underlying
            data apart from charter schools. For that reason, the website includes a simplified district-type-category
            filter with Traditional Public, Charter, and Other. These labels are not a raw source field. They were
            created to make district-type filtering more accessible and easier to interpret for general users.
          </p>
          <p>
            From that source database, we produced two different classes of derived outputs. First, we created
            website-facing analytical tables for the Compare Pay, Pay vs. Experience, and Schools pages. Second, we
            reconstructed document-style profile tables for the Educator Profile page so that users can see fields in
            nearly the same order and naming convention as the original PELSB reports. This second step is important
            for transparency and trust because it allows users to compare the website’s presentation back to the
            familiar structure of the source documents.
          </p>
        </section>

        <section>
          <h3>Entity Definitions and Units of Analysis</h3>
          <p>
            The website uses more than one analytical grain. In employment data, the natural unit is an
            educator-year-district record because salary is recorded at the district employment level. In assignment
            data, the natural unit is an educator-year-district-school-assignment record because one educator may hold
            multiple assignments across schools within the same district. In license data, the natural unit is an
            educator-year-license record. Dashboard outputs therefore depend on the question being asked. Salary
            comparison tools emphasize educator salary records, while school-level tools require additional logic to
            assign educators to a primary district and, when possible, a primary school.
          </p>
          <p>
            The core person-level key used across datasets is file folder number. This identifier is used to link
            employment, assignment, and license records across school years and to connect dashboard rows back to the
            Educator Profile page.
          </p>
        </section>

        <section>
          <h3>Construction of Core Analytical Variables</h3>
          <p>
            Contract salary is taken from the employment records and retained as the primary compensation measure for
            the salary dashboards. Years of experience are also taken from employment records, but because the reports
            contain multiple experience fields for different types of roles, we used role-aware logic to choose the
            most relevant experience measure for a given educator. Highest education level was normalized across years
            and mapped into an ordered education-level scale so that educators can be compared using meaningful
            education bands rather than opaque numeric codes.
          </p>
          <p>
            Educator category and subcategory were derived from assignment records through a role-mapping layer. We
            first mapped assignment codes to educator type and subtype categories, then aggregated assignment FTE by
            educator and year, and then selected the role bucket with the highest total FTE. This yields one primary
            educator role per educator per school year.
          </p>
          <p>
            We also exclude a small set of support-duty assignment codes from public category assignment, including
            Teacher Prep, Homeroom/Advisory, and Monitoring or Study Hall style assignments. Those codes are retained
            in the underlying assignment records and Educator Profile page, but they are ignored when deriving the
            website&apos;s educator category and subcategory filters. This prevents support-period assignments from
            overriding a more recognizable teaching or administrator role in the public dashboards.
          </p>
          <p>
            The educator type and educator subtype filters are also website-created categories rather than direct
            source labels. These groupings were built by organizing similar roles from the 2024-2025 PELSB Assignment
            Licensure Table into broader, more usable categories. That step is essential for answering practical
            questions such as what math teachers get paid or what administrators get paid. Without grouped educator
            categories, users would have to know and interpret many narrower assignment labels that are not well suited
            to public-facing comparison tools.
          </p>
        </section>

        <section>
          <h3>Primary District and School Assignment Logic</h3>
          <p>
            Salary records are fundamentally district-level rather than school-level. For that reason, we selected an
            educator’s primary district from employment records using highest contract days as the first rule, with
            contract salary and district number serving as deterministic tie-breakers. We then selected a primary
            school within that district from assignment records using highest summed assignment FTE. If the dominant
            assignment within the primary district is a district-level placement, represented by school number 0, we
            preserve that district-level placement rather than forcing the educator into a specific school.
          </p>
          <p>
            This distinction matters analytically. A district-level placement does not mean the record is missing; it
            means the educator’s assignment is genuinely reported at the district level. By contrast, some educators
            have a valid district employment record but no matching assignment-based school placement in the same
            district and year. We retain these rows as unmatched school placements rather than inventing a school
            assignment that is not supported by the source data.
          </p>
        </section>

        <section>
          <h3>Compare Pay Methods</h3>
          <p>
            The Compare Pay page is designed to support direct salary comparison across groups of educators. It
            is built from records with a positive salary value and includes location, educator role, experience, and
            education fields that support interactive filtering. Histogram binning is aligned to readable salary
            intervals, and the chart emphasizes the median because public salary data can contain extreme values that
            would otherwise distort the visual distribution.
          </p>
          <p>
            The page includes a broader district-type-category filter above the more detailed district-type filter, and
            school classifications are presented with the most common school types first. A small number of source
            records labeled as Charter School in school-classification fields are grouped into Not reported / Unknown
            rather than treated as a standalone school-classification category. Compare Pay can include educators whose
            salary is known even if some other analytical fields are
            incomplete, as long as those fields are not required for the page’s primary function. This makes it the
            broadest salary-comparison view on the site.
          </p>
        </section>

        <section>
          <h3>Pay vs. Experience Methods</h3>
          <p>
            The Pay vs. Experience page is built from the same underlying salary framework as Compare Pay, but it
            imposes one additional requirement: records must have both a valid salary and a valid years-of-experience
            value. This is necessary because years of experience are plotted on the horizontal axis. As a result, the
            page may show fewer records than Compare Pay even when users apply the same filters. This is
            an expected and intentional difference rather than a data inconsistency.
          </p>
          <p>
            For record counts below 20,000, the page renders individual educators. For larger result sets, the
            page switches to a clustered rendering mode so that broad statewide queries remain usable. In clustered
            mode, the chart aggregates educators into grouped points and suppresses individual tooltips. The page
            explicitly tells users that they can filter below 20,000 results to return to individual educator
            rendering and to display the underlying educator table.
          </p>
        </section>

        <section>
          <h3>Schools Methods</h3>
          <p>
            The Schools page summarizes school-level information rather than educator-level records. It combines school
            location, enrollment, demographic, salary, experience, and education summaries at the school level. Unlike
            the salary dashboards, which now operate across multiple years, the Schools page remains more constrained by
            the availability of historical school-level support tables. Users should therefore interpret the Schools page
            as a school summary tool rather than a complete longitudinal educator dataset.
          </p>
        </section>

        <section>
          <h3>Visualization Decisions</h3>
          <p>
            We made several visualization choices to preserve transparency while keeping the dashboards readable.
            First, we cap chart displays at the 99.9th percentile for salary in some views, but we do not remove those
            higher-salary records from the underlying table results. This prevents a small number of extreme values
            from flattening the visual distribution while still allowing users to inspect the full records. Second, we
            keep the Compare Pay and Pay vs. Experience tables available below the rendering threshold so that users can see
            the individual rows behind the visual summaries. Third, on Pay vs. Experience we render district types with
            explicit color coding and, for overlapping points, use a defined rendering order so that category spread
            remains interpretable.
          </p>
        </section>

        <section>
          <h3>Educator Profile Reconstruction</h3>
          <p>
            The Educator Profile page is intentionally different from the analytical dashboards. Rather than emphasizing
            derived comparison variables, it is designed to present the underlying report records in a form that is
            close to the original PELSB documents. To accomplish this, we reconstructed profile tables in a dedicated
            database by combining fact-table records with district and school dimension tables. This restores fields
            such as district name, district county, school name, school county, school classification, service
            cooperative, and economic development region so that the displayed records align closely with the original
            Employment, Assignment, and License report layouts.
          </p>
          <p>
            The Educator Profile page therefore serves an important trust-building function. It allows users not only
            to use the analytical dashboards, but also to inspect the record-level source information in a familiar
            format and year-specific context.
          </p>
        </section>

        <section>
          <h3>Limitations</h3>
          <p>
            This project remains limited by the structure of the source reports. Salary is reported at the employment
            level rather than split across assignment locations, so we cannot directly observe separate salaries for
            district-level and school-level assignments within the same year. School placement therefore reflects an
            analytically selected primary placement, not a school-specific salary contract. Likewise, some school-level
            support tables are not yet historically complete, which constrains the longitudinal scope of the School
            Map.
          </p>
          <p>
            More generally, the dashboards should be interpreted as tools for comparison and exploration rather than as
            substitutes for district contracts, personnel files, or formal labor agreements. They are strongest as a
            public-access analytical resource built from official reports, not as a legal or contractual authority.
          </p>
        </section>

        <section>
          <h3>Technical Appendix</h3>
          <p>
            The project also includes a technical appendix that documents the database architecture behind the public
            dashboards. The appendix is intended for technical reviewers who want a reproducible account of how the
            public reports were translated into the website&apos;s final analytical and profile tables.
          </p>
          <p>
            At a high level, the system uses three database layers. The master build database stores the normalized
            fact and dimension tables that support reusable data processing. A separate dashboard database stores the
            denormalized web tables used by the Compare Pay, Pay vs. Experience, and Schools pages. A separate profile
            database stores reconstructed document-style tables designed to resemble the original public reports more
            closely.
          </p>
          <p>
            The appendix documents the roles of the core fact tables, the validation of assignment-code and district-
            type reference tables, the reconstruction of one-row-per-educator-year role and school tables, the
            education-level ranking system, and the construction of the all-years salary staging table used to rebuild
            the salary dashboards.
          </p>
          <p>
            It also records the main runtime rules used by the live website. These include year-scoped filter loading,
            chart-only outlier capping at the 99.9th percentile, clustered scatterplot rendering above 20,000 results,
            district-type color coding, and the difference between Compare Pay and Pay vs. Experience record counts when
            salary exists but years-of-experience data do not.
          </p>
          <p>
            Finally, the appendix describes the current rebuild order for the project: repair or update core fact
            tables in the master database, rebuild the educator-role and educator-school helper tables, rebuild the
            all-years salary staging layer, regenerate the dashboard tables, regenerate the document-style profile
            tables, and then refresh the website backend so it serves the updated databases.
          </p>
        </section>
      </div>
    </div>
  );
}
