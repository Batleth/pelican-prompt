
import React from 'react';
import { Prompt } from '../../../types';
import {
    Dialog,
    Bar,
    Button
} from '@ui5/webcomponents-react';

interface DeleteDialogProps {
    open: boolean;
    prompt: Prompt | null;
    onClose: () => void;
    onConfirm: () => void;
}

export const DeleteDialog: React.FC<DeleteDialogProps> = ({ open, prompt, onClose, onConfirm }) => {
    return (
        <Dialog
            open={open}
            headerText="Delete Prompt?"
            onClose={onClose}
            footer={
                <Bar
                    endContent={
                        <>
                            <Button onClick={onClose}>Cancel</Button>
                            <Button design="Negative" onClick={onConfirm}>Delete</Button>
                        </>
                    }
                />
            }
        >
            <div style={{ padding: '1rem' }}>
                <p>Are you sure you want to delete this prompt?</p>
                {prompt && (
                    <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px', marginTop: '12px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--sapBrandColor)', fontSize: '12px', marginBottom: '4px' }}>
                            {prompt.tag || 'No tag'}
                        </div>
                        <div style={{ fontWeight: 500, color: '#333', fontSize: '14px' }}>
                            {prompt.title}
                        </div>
                    </div>
                )}
            </div>
        </Dialog>
    );
};
