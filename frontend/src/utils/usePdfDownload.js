import { Capacitor } from '@capacitor/core'
import { Share } from '@capacitor/share'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

const usePdfDownload = () => {
  const downloadPdf = async (elementId, fileName) => {
    try {
      const element = document.getElementById(elementId)
      if (!element) {
        alert('PDF content nahi mila')
        return
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

      const isNative = Capacitor.isNativePlatform()

      if (isNative) {
        const pdfBlob = pdf.output('blob')
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = reader.result.split(',')[1]
          const tempFile = `${fileName}.pdf`
          await Share.share({
            title: fileName,
            text: `${fileName} PDF`,
            url: `data:application/pdf;base64,${base64}`,
            dialogTitle: 'PDF Save Karo',
          })
        }
        reader.readAsDataURL(pdfBlob)
      } else {
        pdf.save(`${fileName}.pdf`)
      }
    } catch (err) {
      console.error('PDF error:', err)
      alert('PDF download nahi hua. Dobara try karein.')
    }
  }

  return { downloadPdf }
}

export default usePdfDownload
