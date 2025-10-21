/**
 * Format a date string or Date object without timezone conversion
 * This prevents dates from shifting by a day due to timezone differences
 * 
 * @param dateInput - ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ), Date object, or other date formats
 * @returns Formatted date string in the user's locale
 */
export function formatDateWithoutTimezone(dateInput: string | Date): string {
  if (!dateInput) return '';
  
  try {
    // Convert Date object to ISO string if needed
    const dateString = dateInput instanceof Date ? dateInput.toISOString() : dateInput;
    
    // Check if it's an ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
    const isoPattern = /^\d{4}-\d{2}-\d{2}/;
    
    if (isoPattern.test(dateString)) {
      // Extract just the date part (YYYY-MM-DD)
      const datePart = dateString.split('T')[0];
      const [year, month, day] = datePart.split('-');
      
      // Validate the parts
      const y = parseInt(year);
      const m = parseInt(month) - 1;
      const d = parseInt(day);
      
      if (isNaN(y) || isNaN(m) || isNaN(d)) {
        // Fall back to standard parsing
        return new Date(dateString).toLocaleDateString();
      }
      
      // Create date in local timezone by specifying year, month (0-indexed), day
      // This avoids timezone conversion that happens with new Date(dateString)
      const date = new Date(y, m, d);
      
      // Check if the date is valid
      if (isNaN(date.getTime())) {
        return new Date(dateString).toLocaleDateString();
      }
      
      return date.toLocaleDateString();
    } else {
      // For non-ISO formats (e.g., MM/DD/YYYY), use standard Date parsing
      // which should handle it correctly in the user's timezone
      const date = new Date(dateString);
      
      if (isNaN(date.getTime())) {
        // If date is invalid, return the original string
        return String(dateString);
      }
      
      return date.toLocaleDateString();
    }
  } catch (error) {
    // If any error occurs, try to parse it normally or return the original
    console.error('Error formatting date:', error);
    try {
      return new Date(dateInput).toLocaleDateString();
    } catch {
      return String(dateInput);
    }
  }
}
