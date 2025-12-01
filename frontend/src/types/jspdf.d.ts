declare module 'jspdf' {
  // Minimal type declaration to satisfy TypeScript in this project.
  // jsPDF is a constructor function that returns a PDF instance.
  // Using 'any' here keeps things simple without impacting runtime behavior.
  // If you need stronger typing later, you can replace this with full typings.
  const jsPDF: any
  export default jsPDF
}


