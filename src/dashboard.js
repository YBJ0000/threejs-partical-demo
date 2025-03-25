import * as THREE from 'three';
import { gsap } from 'gsap';
import ApiService from './api';

class Dashboard {
  constructor() {
    this.token = localStorage.getItem('token');
    this.userId = localStorage.getItem('userId');
    if (!this.token || !this.userId) {
      window.location.href = '/';
      return;
    }

    // 删除重复的事件监听器设置
    this.setupLogoutHandler();
    // 删除这行，因为相关功能已经在 setupEventListeners 中处理
    // this.setupNewThreadHandler();
    
    this.setupScene();
    this.setupParticles();
    this.setupEventListeners();
    this.loadThreads();
    this.showWelcomeAnimation();
    this.animate();
  }

  // 删除整个 setupNewThreadHandler 方法，因为这些功能已经在 setupEventListeners 中实现
  // setupNewThreadHandler() { ... }

  setupLogoutHandler() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.clear();
        window.location.href = '/';
      });
    }
  }

  setupNewThreadHandler() {
    const newThreadBtn = document.getElementById('newThreadBtn');
    const cancelThreadBtn = document.getElementById('cancelThread');
    const submitThreadBtn = document.getElementById('submitThread');
    const newThreadModal = document.getElementById('newThreadModal');

    if (newThreadBtn) {
      newThreadBtn.addEventListener('click', () => {
        newThreadModal.classList.remove('hidden');
      });
    }

    if (cancelThreadBtn) {
      cancelThreadBtn.addEventListener('click', () => {
        newThreadModal.classList.add('hidden');
      });
    }

    if (submitThreadBtn) {
      submitThreadBtn.addEventListener('click', async () => {
        const title = document.getElementById('newThreadTitle').value;
        const content = document.getElementById('newThreadContent').value;
        const isPublic = document.getElementById('threadIsPublic').checked;
        
        if (!title || !content) {
          alert('Please fill in all fields');
          return;
        }
      
        try {
          await ApiService.createThread(this.token, title, isPublic, content);
          newThreadModal.classList.add('hidden');
          document.getElementById('newThreadTitle').value = '';
          document.getElementById('newThreadContent').value = '';
          this.loadThreads();
        } catch (error) {
          alert(error.message);
        }
      });
    }
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.insertBefore(this.renderer.domElement, document.body.firstChild);

    this.camera.position.z = 50;
    this.camera.position.y = -13;

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  setupParticles() {
    const particleCount = 40000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 100;

      colors[i * 3] = Math.random();
      colors[i * 3 + 1] = Math.random();
      colors[i * 3 + 2] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 0.7
    });

    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  setupEventListeners() {
    // 登出功能
    document.getElementById('logoutBtn').addEventListener('click', () => {
      localStorage.removeItem('token');
      localStorage.removeItem('userId');
      window.location.href = '/';
    });

    // 新建帖子相关
    document.getElementById('newThreadBtn').addEventListener('click', () => {
      document.getElementById('newThreadModal').classList.remove('hidden');
    });

    document.getElementById('cancelThread').addEventListener('click', () => {
      document.getElementById('newThreadModal').classList.add('hidden');
    });

    document.getElementById('submitThread').addEventListener('click', async () => {
      const title = document.getElementById('newThreadTitle').value;
      const content = document.getElementById('newThreadContent').value;
      const isPublic = document.getElementById('threadIsPublic').checked;
      
      if (!title || !content) {
        alert('Please fill in all fields');
        return;
      }
    
      try {
        await ApiService.createThread(this.token, title, isPublic, content);
        document.getElementById('newThreadModal').classList.add('hidden');
        document.getElementById('newThreadTitle').value = '';
        document.getElementById('newThreadContent').value = '';
        this.loadThreads();
      } catch (error) {
        alert(error.message);
      }
    });

    // 评论相关
    document.getElementById('submitComment').addEventListener('click', async () => {
      const content = document.getElementById('newComment').value;
      const threadId = this.currentThreadId;
      if (!content || !threadId) return;

      try {
        await ApiService.createComment(this.token, threadId, content);
        document.getElementById('newComment').value = '';
        this.loadComments(threadId);
      } catch (error) {
        alert(error.message);
      }
    });

    // 编辑帖子相关
    document.getElementById('cancelEditThread').addEventListener('click', () => {
      document.getElementById('editThreadModal').classList.add('hidden');
    });

    document.getElementById('submitEditThread').addEventListener('click', async () => {
      try {
        const threadData = {
          id: this.currentThreadId,
          title: document.getElementById('editThreadTitle').value,
          content: document.getElementById('editThreadContent').value,
          isPublic: document.getElementById('editThreadIsPublic').checked,
          lock: document.getElementById('editThreadLock').checked
        };

        await ApiService.updateThread(this.token, threadData);
        document.getElementById('editThreadModal').classList.add('hidden');
        this.showThreadDetail(this.currentThreadId);
        this.loadThreads();
      } catch (error) {
        alert(error.message);
      }
    });

    // 将 dashboard 实例添加到 window 对象
    window.dashboard = this;
}

  async loadThreads() {
    try {
      const threads = await ApiService.getThreads(this.token);
      const threadsList = document.getElementById('threadsList');
      threadsList.innerHTML = '';

      threads.forEach(threadId => {
        const threadElement = document.createElement('div');
        threadElement.className = 'thread-item';
        threadElement.dataset.threadId = threadId;
        
        ApiService.getThread(this.token, threadId)
          .then(threadDetail => {
            threadElement.innerHTML = `
              <h3>${threadDetail.title || 'Untitled'}</h3>
            `;
          })
          .catch(error => {
            threadElement.innerHTML = `<p>Error loading thread</p>`;
            console.error('Error loading thread:', error);
          });

        threadElement.addEventListener('click', () => this.showThreadDetail(threadId));
        threadsList.appendChild(threadElement);
      });
    } catch (error) {
      alert(error.message);
    }
}

  async showThreadDetail(threadId) {
      try {
        const thread = await ApiService.getThread(this.token, threadId);
        this.currentThreadId = threadId;
        this.currentThread = thread;
  
        const isLiked = thread.likes && thread.likes[this.userId];
        const isWatched = thread.watchees && thread.watchees[this.userId];
  
        const threadDetail = document.getElementById('threadDetail');
        const threadContent = document.getElementById('threadContent');
        
        threadDetail.classList.remove('hidden');
        threadContent.innerHTML = `
          <div class="thread-detail-content">
            <div class="thread-header">
              <h2>${thread.title}</h2>
              <div class="thread-actions">
                <button class="action-btn like-btn ${isLiked ? 'active' : ''}" 
                  onclick="window.dashboard.toggleLike(${threadId})">
                  ${isLiked ? '❤️' : '🤍'}
                </button>
                <button class="action-btn watch-btn ${isWatched ? 'active' : ''}" 
                  onclick="window.dashboard.toggleWatch(${threadId})">
                  ${isWatched ? '👁️' : '👁️‍🗨️'}
                </button>
                ${thread.creatorId === parseInt(this.userId) ? `
                  <button class="auth-button edit-thread-btn" onclick="window.dashboard.showEditThreadModal()">Edit</button>
                  <button class="auth-button delete-thread-btn" onclick="window.dashboard.confirmDeleteThread()">Delete</button>
                ` : ''}
              </div>
            </div>
            <div class="thread-metadata">
              <span class="thread-date">${new Date(thread.createdAt).toLocaleDateString()}</span>
              ${thread.lock ? '<span class="thread-locked">🔒 Locked</span>' : ''}
            </div>
            <div class="thread-body">
              ${thread.content}
            </div>
          </div>
        `;
  
        this.loadComments(threadId);
      } catch (error) {
        alert(error.message);
      }
  }
  
  // 添加toggle方法
  async toggleLike(threadId) {
    try {
      const thread = this.currentThread;
      const isCurrentlyLiked = thread.likes && thread.likes[this.userId];
      const response = await ApiService.likeThread(this.token, threadId, !isCurrentlyLiked);
      
      // 更新当前线程的状态
      if (!isCurrentlyLiked) {
        if (!thread.likes) thread.likes = {};
        thread.likes[this.userId] = true;
      } else {
        delete thread.likes[this.userId];
      }
      
      // 更新UI
      const likeBtn = document.querySelector('.like-btn');
      if (likeBtn) {
        likeBtn.innerHTML = thread.likes[this.userId] ? '❤️' : '🤍';
        likeBtn.classList.toggle('active', thread.likes[this.userId]);
      }
    } catch (error) {
      alert(error.message);
    }
  }
  
  async toggleWatch(threadId) {
    try {
      const thread = this.currentThread;
      const isCurrentlyWatched = thread.watchees && thread.watchees[this.userId];
      const response = await ApiService.watchThread(this.token, threadId, !isCurrentlyWatched);
      
      // 更新当前线程的状态
      if (!isCurrentlyWatched) {
        if (!thread.watchees) thread.watchees = {};
        thread.watchees[this.userId] = true;
      } else {
        delete thread.watchees[this.userId];
      }
      
      // 更新UI
      const watchBtn = document.querySelector('.watch-btn');
      if (watchBtn) {
        watchBtn.innerHTML = thread.watchees[this.userId] ? '👁️' : '👁️‍🗨️';
        watchBtn.classList.toggle('active', thread.watchees[this.userId]);
      }
    } catch (error) {
      alert(error.message);
    }
  }
  
  // 添加删除确认方法
  confirmDeleteThread() {
      if (confirm('确定要删除这个帖子吗？此操作不可撤销。')) {
          this.deleteThread();
      }
  }
  
  // 添加删除帖子方法
  async deleteThread() {
      try {
          await ApiService.deleteThread(this.token, this.currentThreadId);
          document.getElementById('threadDetail').classList.add('hidden');
          this.loadThreads(); // 刷新帖子列表
      } catch (error) {
          alert(error.message);
      }
  }
  
  // 添加显示编辑模态框的方法
  showEditThreadModal() {
      const thread = this.currentThread;
      document.getElementById('editThreadTitle').value = thread.title;
      document.getElementById('editThreadContent').value = thread.content;
      document.getElementById('editThreadIsPublic').checked = thread.isPublic;
      document.getElementById('editThreadLock').checked = thread.lock;
      document.getElementById('editThreadModal').classList.remove('hidden');
  }

  async loadComments(threadId) {
    try {
      const comments = await ApiService.getComments(this.token, threadId);
      const commentsList = document.getElementById('commentsList');
      commentsList.innerHTML = '';

      comments.forEach(comment => {
        const commentElement = document.createElement('div');
        commentElement.className = 'comment-item';
        commentElement.innerHTML = `
                    <p>${comment.content}</p>
                    ${comment.userId === this.userId ? `
                        <button class="auth-button" onclick="deleteComment('${comment.id}')">Delete</button>
                    ` : ''}
                `;
        commentsList.appendChild(commentElement);
      });
    } catch (error) {
      alert(error.message);
    }
  }

  async deleteComment(commentId) {
    try {
      await ApiService.deleteComment(this.token, commentId);
      this.loadComments(this.currentThreadId);
    } catch (error) {
      alert(error.message);
    }
  }

  async showWelcomeAnimation() {
    try {
        const profile = await ApiService.getUserProfile(this.token, this.userId);
        if (profile.name) {
            // 显示欢迎文字
            const welcomeText = `Welcome, ${profile.name}!`;
            const positions = this.particles.geometry.attributes.position.array;
            
            // 先转换成欢迎文字
            this.transformToText(welcomeText);
            
            // 5秒后恢复漩涡效果
            setTimeout(() => {
                // 使用GSAP创建平滑过渡
                const targetPositions = new Float32Array(positions.length);
                for (let i = 0; i < positions.length; i += 3) {
                    targetPositions[i] = (Math.random() - 0.5) * 100;
                    targetPositions[i + 1] = (Math.random() - 0.5) * 100;
                    targetPositions[i + 2] = (Math.random() - 0.5) * 100;
                }
                
                gsap.to(positions, {
                    endArray: targetPositions,
                    duration: 2,
                    ease: "power2.inOut",
                    onUpdate: () => {
                        this.particles.geometry.attributes.position.needsUpdate = true;
                    }
                });
            }, 3000);
        }
    } catch (error) {
        console.error('Error loading welcome animation:', error);
    }
}

  // 添加文字转换方法（从 ParticleSystem 类复制过来）
  transformToText(text) {
      // 创建临时 canvas 用于渲染文字
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 2048;
      canvas.height = 256;
  
      // 设置文字样式并渲染
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '120px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
      // 获取像素数据
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const positions = this.particles.geometry.attributes.position.array;
      let particleIndex = 0;
  
      // 根据文字像素重新排列粒子
      for (let i = 0; particleIndex < positions.length / 3 && i < imageData.length; i += 4) {
          if (imageData[i] > 128) {
              const x = ((i / 4) % canvas.width - canvas.width / 2) * 0.1;
              const y = (Math.floor((i / 4) / canvas.width) - canvas.height / 2) * 0.1;
              
              gsap.to(positions, {
                  duration: 2,
                  ease: "power2.inOut",
                  [particleIndex * 3]: x,
                  [particleIndex * 3 + 1]: -y,
                  [particleIndex * 3 + 2]: 0,
                  onUpdate: () => {
                      this.particles.geometry.attributes.position.needsUpdate = true;
                  }
              });
              
              particleIndex++;
          }
      }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const positions = this.particles.geometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      const angle = Math.atan2(z, x) + 0.005;
      const radius = Math.sqrt(x * x + z * z);
      positions[i] = radius * Math.cos(angle);
      positions[i + 2] = radius * Math.sin(angle);
      positions[i + 1] += Math.sin(Date.now() * 0.001 + radius * 0.03) * 0.02;
    }

    this.particles.geometry.attributes.position.needsUpdate = true;
    this.renderer.render(this.scene, this.camera);
  }
}

window.hideThreadDetail = () => {
  document.getElementById('threadDetail').classList.add('hidden');
};

window.deleteComment = async (commentId) => {
  if (window.dashboard) {
    await window.dashboard.deleteComment(commentId);
  }
};

window.dashboard = new Dashboard();