import React, { useEffect, useRef, useState } from 'react';
import grapesjs from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';

const ReportBuilder = () => {
  const editorRef = useRef(null);
  const [finalHtml, setFinalHtml] = useState('');
  const editorInstance = useRef(null);

  useEffect(() => {
    if (!editorRef.current) return;

    // Clear existing content
    const container = document.getElementById('gjs');
    if (container) container.innerHTML = '';

    try {
      // Initialize GrapesJS editor
      const editor = grapesjs.init({
        container: '#gjs',
        height: '90vh',
        width: 'auto',
        fromElement: false,
        storageManager: false,
        panels: {
          defaults: [
            {
              id: 'commands',
              buttons: [
                { id: 'undo', className: 'fa fa-undo', command: 'core:undo', attributes: { title: 'Undo' } },
                { id: 'redo', className: 'fa fa-redo', command: 'core:redo', attributes: { title: 'Redo' } },
                {
                  id: 'export',
                  className: 'fa fa-code',
                  command: (editor) => {
                    const html = editor.getHtml();
                    alert(html); // Replace with a modal or better UI for code preview
                  },
                  attributes: { title: 'View Code' },
                },
              ],
            },
            {
              id: 'views',
              buttons: [
                { id: 'open-blocks', active: true, label: 'Blocks', command: 'open-blocks', togglable: false },
              ],
            },
          ],
        },
        blockManager: {
          appendTo: '#blocks',
        },
      });

      editorInstance.current = editor;

      // Define field blocks
      const fields = [
        { name: 'Student Name', value: '{{student_name}}' },
        { name: 'Roll No', value: '{{roll_no}}' },
        { name: 'Class', value: '{{class}}' },
        { name: 'Math', value: '{{math}}' },
        { name: 'Science', value: '{{science}}' },
        { name: 'English', value: '{{english}}' },
        { name: 'Remarks', value: '{{remarks}}' },
      ];

      fields.forEach((field) => {
        editor.BlockManager.add(field.value, {
          label: field.name,
          category: 'Fields',
          content: `<span>${field.value}</span>`,
        });
      });

      // Set default template
      editor.setComponents(`
        <div style="padding: 25px; font-family: Arial;">
          <h2 style="text-align: center;">Green Valley Public School</h2>
          <h3 style="text-align: center;">PT-1 Result</h3>
          <p><strong>Student Name:</strong> {{student_name}}</p>
          <p><strong>Roll No:</strong> {{roll_no}} &nbsp; <strong>Class:</strong> {{class}}</p>
          <table style="width: 100%; border-collapse: collapse;" border="1">
            <thead>
              <tr style="background-color:#f0f0f0;">
                <th>Subject</th>
                <th>Marks Obtained</th>
                <th>Max Marks</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Math</td><td>{{math}}</td><td>40</td></tr>
              <tr><td>Science</td><td>{{science}}</td><td>40</td></tr>
              <tr><td>English</td><td>{{english}}</td><td>40</td></tr>
            </tbody>
          </table>
          <p style="margin-top: 20px;"><strong>Remarks:</strong> {{remarks}}</p>
        </div>
      `);

      // Sample student data
      const studentData = {
        student_name: 'Gurmanjeet Singh',
        roll_no: '18',
        class: 'VI-B',
        math: '36',
        science: '33',
        english: '39',
        remarks: 'Excellent improvement!',
      };

      // Update preview on component change
      const updatePreview = () => {
        let html = editor.getHtml();
        Object.entries(studentData).forEach(([key, value]) => {
          html = html.replaceAll(`{{${key}}}`, value);
        });
        setFinalHtml(html);
      };

      // Initial preview
      updatePreview();

      // Listen for component changes
      editor.on('component:update', updatePreview);

      // Activate blocks panel
      editor.Panels.getButton('views', 'open-blocks')?.set('active', true);

      // Cleanup on unmount
      return () => {
        editor.destroy();
        editorInstance.current = null;
      };
    } catch (error) {
      console.error('Failed to initialize GrapesJS:', error);
    }
  }, []);

  return (
    <div className="container-fluid mt-3">
      <h3 className="text-center mb-3">📋 PT Result Report Builder</h3>
      <div className="row">
        <div id="blocks" className="col-md-2 border-end" style={{ background: '#f8f9fa' }}></div>
        <div className="col-md-10" id="gjs" ref={editorRef}></div>
      </div>
      <div className="container my-5">
        <h4>👁 Preview with Sample Data:</h4>
        <div className="p-3 border" dangerouslySetInnerHTML={{ __html: finalHtml }} />
      </div>
    </div>
  );
};

export default ReportBuilder;