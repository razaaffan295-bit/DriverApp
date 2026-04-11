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
        const base64 = pdf.output('datauristring').split(',')[1]
        const { Filesystem, Directory } = await import('@capacitor/filesystem')
        const fname = `${fileName}_${Date.now()}.pdf`
        await Filesystem.writeFile({
          path: fname,
          data: base64,
          directory: Directory.Cache,
        })
        const fileUri = await Filesystem.getUri({
          path: fname,
          directory: Directory.Cache,
        })
        await Share.share({
          title: fileName,
          text: fileName,
          url: fileUri.uri,
          dialogTitle: 'PDF Save Karo ya Share Karein',
        })
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
