// Status formatting utility
export function useStatusFormatter() {
  const formatStatus = (status) => {
    if (!status) return 'N/A';
    
    const statusMap = {
      'PENDING': 'Pending',
      'APPROVED': 'Approved',
      'IN_PROGRESS': 'In Progress',
      'COMPLETED': 'Completed',
      'REJECTED': 'Rejected',
      'BOOKED': 'Booked',
      'CANCELLED': 'Cancelled',
      'SUBMITTED': 'Submitted',
      'HR_REVIEW': 'HR Review',
      'IT_SETUP': 'IT Setup',
      'ACTIVE': 'Active',
      'INACTIVE': 'Inactive'
    };
    
    // Return formatted version if exists, otherwise return original
    return statusMap[status.toUpperCase()] || status;
  };
  
  return {
    formatStatus
  };
}

