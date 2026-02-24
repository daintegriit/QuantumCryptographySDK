import { useState } from "react";
import Modal from "react-modal";

// Bind modal to root element for accessibility
Modal.setAppElement("#root");

export default function HowItWorksModal() {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return (
    <div className="text-center mt-4">
      <button
        onClick={openModal}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition duration-300"
      >
        How It Works?
      </button>

      <Modal
        isOpen={isOpen}
        onRequestClose={closeModal}
        contentLabel="How QuantumShield Works"
        className="modal-content"
        overlayClassName="modal-overlay"
      >
        <h2 className="text-2xl font-bold mb-4">
          How QuantumShield Works
        </h2>

        <p className="mb-4">
          QuantumShield uses lattice-based encryption to defend against
          quantum computing attacks, while also integrating
          AI-powered cryptanalysis to ensure the highest level of security.
        </p>

        <p className="mb-4">
          The key generation process is secure and fast, and our system
          allows homomorphic encryption to perform calculations without
          revealing sensitive data.
        </p>

        <button
          onClick={closeModal}
          className="mt-6 bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 transition"
        >
          Close
        </button>
      </Modal>
    </div>
  );
}