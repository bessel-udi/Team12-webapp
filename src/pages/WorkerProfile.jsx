import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProviderInventory from '../components/ProviderInventory';

export default function WorkerProfile() {
  const navigate = useNavigate();
  // Mock data for a local fundi
  const worker = {
    name: "John Juma",
    title: "Expert Plumber & Handyman",
    location: "Nairobi, Kenya",
    rating: 4.8,
    reviewsCount: 24,
    skills: ["Leak Repair", "Pipe Fitting", "Borehole Pumps", "Appliance Installation"],
    priceEstimates: [
      { service: "Consultation & Inspection", cost: "Ksh 1,500" },
      { service: "Minor Repairs (per hour)", cost: "Ksh 1,000" },
      { service: "Major Installation Work", cost: "Ksh 3,500+" }
    ],
    reviews: [
      { id: 1, user: "Grace W.", rating: 5, text: "John arrived on time and fixed our kitchen sink perfectly. Fair pricing and professional!", date: "June 18, 2026" },
      { id: 2, user: "David O.", rating: 4, text: "Very knowledgeable. Cleared a major drainage blockage quickly.", date: "June 12, 2026" }
    ]
  };

  // Inline styles to match your team's convention
  const styles = {
    container: {
  padding: "20px", // Exact match to Member 1's layout structure!
  maxWidth: "800px",
  margin: "0 auto",
  fontFamily: "system-ui, sans-serif",
  color: "#333",
  lineHeight: "1.6"
},
    headerCard: {
      backgroundColor: "#f9f9f9",
      border: "1px solid #eee",
      borderRadius: "12px",
      padding: "24px",
      marginBottom: "20px",
      display: "flex",
      gap: "20px",
      alignItems: "center"
    },
    avatarPlaceholder: {
      width: "90px",
      height: "90px",
      borderRadius: "50%",
      backgroundColor: "#ddd",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "32px"
    },
    section: {
      marginBottom: "30px"
    },
    sectionTitle: {
      fontSize: "18px",
      fontWeight: "600",
      borderBottom: "2px solid #f0f0f0",
      paddingBottom: "8px",
      marginBottom: "15px"
    },
    tagContainer: {
      display: "flex",
      gap: "8px",
      flexWrap: "wrap"
    },
    tag: {
      backgroundColor: "#eef2f3",
      padding: "6px 12px",
      borderRadius: "20px",
      fontSize: "13px",
      fontWeight: "500"
    },
    table: {
      width: "100%",
      borderCollapse: "collapse",
      marginTop: "10px"
    },
    th: {
      textAlign: "left",
      padding: "10px",
      backgroundColor: "#f5f5f5",
      borderBottom: "2px solid #ddd",
      fontSize: "14px"
    },
    td: {
      padding: "12px 10px",
      borderBottom: "1px solid #eee",
      fontSize: "14px"
    },
    reviewCard: {
      border: "1px solid #f0f0f0",
      borderRadius: "8px",
      padding: "15px",
      marginBottom: "12px",
      backgroundColor: "#fff"
    },
    bookButton: {
      backgroundColor: "#0F6E56", // Matching the project roadmap's teal accent palette
      color: "white",
      border: "none",
      padding: "12px 24px",
      borderRadius: "6px",
      fontSize: "15px",
      fontWeight: "bold",
      cursor: "pointer",
      width: "100%",
      marginTop: "10px"
    }
  };

  return (
    <div style={styles.container}>
      {/* 1. Header Layout Section */}
      <div style={styles.headerCard}>
        <div style={styles.avatarPlaceholder}>🛠️</div>
        <div>
          <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>{worker.name}</h1>
          <p style={{ color: "#666", fontWeight: "500" }}>{worker.title}</p>
          <p style={{ fontSize: "14px", color: "#888" }}>📍 {worker.location}</p>
          <p style={{ fontSize: "14px", marginTop: "6px", color: "#e67e22" }}>
            ⭐ <strong>{worker.rating}</strong> ({worker.reviewsCount} reviews)
          </p>
        </div>
      </div>

      {/* Skills Sub-Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Specialties</h2>
        <div style={styles.tagContainer}>
          {worker.skills.map((skill, index) => (
            <span key={index} style={styles.tag}>{skill}</span>
          ))}
        </div>
      </div>

      {/* 2. Price Estimate Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Estimated Pricing</h2>
        
        {/* This is the new wrapper div that enables horizontal scrolling on small phone screens */}
        <div style={{ overflowX: "auto" }}> 
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Service Type</th>
                <th style={styles.th}>Estimated Rate</th>
              </tr>
            </thead>
            <tbody>
              {worker.priceEstimates.map((item, index) => (
                <tr key={index}>
                  <td style={styles.td}>{item.service}</td>
                  <td style={styles.td}><strong>{item.cost}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> {/* End of the responsive wrapper div */}

      </div>
      
               {/* Provider stock, fetched from the LiteStock partner API via our server */}
         <div style={styles.section}>
           <ProviderInventory providerId={15} />
         </div>
         
      {/* 3. Ratings & Reviews Display Section */}
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Client Reviews</h2>
        {worker.reviews.map((rev) => (
          <div key={rev.id} style={styles.reviewCard}>
            <div style={{ display: "flex", justifyContent: "between", marginBottom: "6px", fontSize: "13px" }}>
              <strong style={{ marginRight: "10px" }}>{rev.user}</strong>
              <span style={{ color: "#e67e22" }}>{"⭐".repeat(rev.rating)}</span>
              <span style={{ marginLeft: "auto", color: "#999" }}>{rev.date}</span>
            </div>
            <p style={{ fontSize: "14px", color: "#555" }}>{rev.text}</p>
          </div>
        ))}
      </div>

      {/* Call to Action to pass flow to Member 4 */}
      <button 
       style={styles.bookButton}
       onClick={() => navigate('/booking')}
       >
        Proceed to Booking
       </button>
    </div>
  );
}